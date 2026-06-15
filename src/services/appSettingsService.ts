import { supabase } from './supabaseClient';

/**
 * Service to manage global application settings in Supabase
 * primarily used for synchronizing UI state across different machines.
 */

export const getAppSettings = async (): Promise<Record<string, any>> => {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('key, value');

        if (error) {
            console.error('[getAppSettings] Error:', error);
            return {};
        }

        const settings: Record<string, any> = {};
        data?.forEach((item: { key: string; value: string }) => {
            try {
                settings[item.key] = JSON.parse(item.value);
            } catch (e) {
                settings[item.key] = item.value;
            }
        });

        return settings;
    } catch (e) {
        console.error('[getAppSettings] Unexpected error:', e);
        return {};
    }
};

export const updateAppSetting = async (key: string, value: any): Promise<boolean> => {
    try {
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

        const { error } = await supabase
            .from('app_settings')
            .upsert({ key, value: stringValue, updated_at: new Date().toISOString() }, { onConflict: 'key' });

        if (error) {
            console.error(`[updateAppSetting] Error updating ${key}:`, error);
            return false;
        }

        return true;
    } catch (e) {
        console.error(`[updateAppSetting] Unexpected error updating ${key}:`, e);
        return false;
    }
};

export const subscribeToAppSettings = (onUpdate: (payload: any) => void) => {
    return supabase
        .channel('public:app_settings')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload) => {
            onUpdate(payload);
        })
        .subscribe();
};
