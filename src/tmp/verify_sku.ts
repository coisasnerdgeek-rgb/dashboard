
import { parseSku, getSkuError } from './services/skuService';

const testSkus = [
    'babylook-meninas-super-poderosas-preto-p',
    'kit3-babylook-branca-m',
    'cam-masc-royal-g',
    'polo-fem-plus-vinho-xg'
];

console.log('--- Current SKU Validation ---');
testSkus.forEach(sku => {
    const parsed = parseSku(sku);
    const error = getSkuError(sku);
    console.log(`SKU: ${sku}`);
    console.log(`Parsed:`, parsed);
    console.log(`Error:`, error ? error.message : 'NONE');
    console.log('-------------------');
});
