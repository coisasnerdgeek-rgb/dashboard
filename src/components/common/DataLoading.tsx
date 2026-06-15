import * as React from 'react';

const LOADING_MESSAGES = [
    "Iniciando os motores...",
    "Acordando os hamsters que movem o servidor...",
    "Convencendo os dados a cooperar...",
    "Ajustando os pixels rebeldes...",
    "Fazendo um café para a CPU...",
    "Organizando as planilhas...",
    "Procurando aquele pedido que sumiu...",
    "Conferindo se tudo está no lugar certo...",
    "Quase lá! Só mais um pouquinho...",
    "Últimos ajustes...",
    "Pronto! Só falta o cafézinho...",
    "Contando as estampas uma por uma...",
    "Desembaraçando os fios da internet...",
    "Calibrando o gerador de sorte...",
    "Negociando com o banco de dados...",
    "Aquecendo os servidores...",
    "Polindo os dados para você...",
    "Sincronizando com as estrelas...",
    "Carregando toneladas de pixels...",
    "Dando corda nos relógios do sistema...",
    "Enchendo o tanque de energia...",
    "Testando a paciência do computador...",
    "Ajustando a antena de Wi-Fi...",
    "Conferindo duas vezes só por garantia...",
    "Preparando tudo com carinho...",
    "Separando os pedidos urgentes...",
    "Calculando a velocidade da luz...",
    "Criando um portal dimensional...",
    "Verificando se está tudo certo...",
    "Quase pronto, prometo!",
    "Só mais alguns nanosegundos..."
];

interface DataLoadingProps {
    message?: string;
    fullScreen?: boolean;
}

const DataLoading: React.FC<DataLoadingProps> = ({ message, fullScreen = true }) => {
    const [messageIndex, setMessageIndex] = React.useState(0);

    React.useEffect(() => {
        const interval = setInterval(() => {
            setMessageIndex(prev => {
                let nextIndex = Math.floor(Math.random() * LOADING_MESSAGES.length);
                if (LOADING_MESSAGES.length > 1 && nextIndex === prev) {
                    nextIndex = (nextIndex + 1) % LOADING_MESSAGES.length;
                }
                return nextIndex;
            });
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const content = (
        <div className="flex flex-col items-center max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-300">
            <div className="relative mb-8">
                {/* Pulsing Disk Graphic */}
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500 via-indigo-500 to-purple-600 rounded-full animate-ping opacity-25"></div>
                <div className="absolute inset-[-8px] bg-gradient-to-tr from-blue-400 to-purple-400 rounded-full animate-pulse opacity-10 blur-xl"></div>

                <div className="relative bg-white dark:bg-gray-800 rounded-full p-4 shadow-2xl border border-white/20 dark:border-gray-700/50">
                    <svg className="animate-spin h-14 w-14 text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-10" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                        <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
            </div>

            <div className="text-center space-y-3">
                <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                    Processando Dados
                </h2>
                <div className="h-1 w-24 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full opacity-50"></div>
                <p className="text-gray-500 dark:text-gray-400 font-medium animate-pulse min-h-[1.5em] text-sm md:text-base px-4">
                    {message || LOADING_MESSAGES[messageIndex]}
                </p>
            </div>
        </div>
    );

    if (!fullScreen) {
        return (
            <div className="flex items-center justify-center p-12 w-full h-full min-h-[400px]">
                {content}
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex items-center justify-center z-[100] transition-all duration-500">
            {content}
        </div>
    );
};

export default DataLoading;
