import * as React from 'react';

interface SplashScreenProps {
    onFinish?: () => void;
}

// Frases engraçadas que mudam conforme o progresso
const loadingMessages = [
    { percent: 0, message: "Iniciando os motores..." },
    { percent: 10, message: "Acordando os hamsters que movem o servidor..." },
    { percent: 20, message: "Convencendo os dados a cooperar..." },
    { percent: 30, message: "Ajustando os pixels rebeldes..." },
    { percent: 40, message: "Fazendo um café para a CPU..." },
    { percent: 50, message: "Organizando as planilhas..." },
    { percent: 60, message: "Procurando aquele pedido que sumiu..." },
    { percent: 70, message: "Conferindo se tudo está no lugar certo..." },
    { percent: 80, message: "Quase lá! Só mais um pouquinho..." },
    { percent: 90, message: "Últimos ajustes..." },
    { percent: 95, message: "Pronto! Só falta o cafezinho..." },
];

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
    const [progress, setProgress] = React.useState(0);
    const [currentMessage, setCurrentMessage] = React.useState(loadingMessages[0].message);

    React.useEffect(() => {
        // Simula carregamento progressivo
        const interval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setTimeout(() => onFinish?.(), 300);
                    return 100;
                }

                const nextProgress = prev + Math.random() * 8 + 2; // Incremento aleatório entre 2 e 10
                const finalProgress = Math.min(nextProgress, 100);

                // Atualiza mensagem baseada no progresso
                const message = loadingMessages.findLast(m => finalProgress >= m.percent);
                if (message) {
                    setCurrentMessage(message.message);
                }

                return finalProgress;
            });
        }, 150); // Atualiza a cada 150ms

        return () => clearInterval(interval);
    }, [onFinish]);

    return (
        <div className="fixed inset-0 z-[9999] bg-[#020205] overflow-hidden flex flex-col items-center justify-center">

            {/* Deep Space Background with subtle gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-black via-[#0a0a1a] to-black opacity-90"></div>

            {/* Stars / Speed Particles Container */}
            <div className="absolute inset-0 overflow-hidden perspective-container">
                {/* Hyper-speed neon trails */}
                {[...Array(30)].map((_, i) => (
                    <div
                        key={`trail-${i}`}
                        className="neon-trail"
                        style={{
                            top: `${Math.random() * 100}%`,
                            width: `${Math.random() * 300 + 150}px`, // Longer trails
                            height: `${Math.random() * 2 + 1}px`,     // Thinner/Thicker variation
                            animationDelay: `${Math.random() * 1}s`,
                            animationDuration: `${Math.random() * 0.6 + 0.2}s`, // Faster
                            opacity: Math.random() * 0.8 + 0.2,
                            background: i % 3 === 0 ? 'linear-gradient(90deg, transparent, #ff00de, transparent)' : // Pink
                                i % 3 === 1 ? 'linear-gradient(90deg, transparent, #00f2ff, transparent)' : // Cyan
                                    'linear-gradient(90deg, transparent, #ffffff, transparent)'   // White
                        }}
                    ></div>
                ))}
            </div>

            {/* The Rocket Container */}
            <div className="relative z-10 animate-rocket-flight">
                {/* Stylish Sci-Fi Rocket SVG (User Provided) */}
                <div className="transform rotate-90 scale-150 filter drop-shadow-[0_0_15px_rgba(0,242,255,0.5)]">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
                        <g>
                            {/* Fins/Engine Base */}
                            <path fill="#FF0000" d="M49,68.2c8,0,15.1,5.7,18.9,14.2c0.8-2.2,1.3-4.5,1.3-6.9c0-11.1-9-20-20.2-20s-20.2,9-20.2,20     c0,2.4,0.5,4.8,1.3,6.9C33.9,73.9,41,68.2,49,68.2z" />
                            <rect x="42.9" y="69.5" fill="#2683EA" width="12.2" height="4.2" />

                            {/* Flames */}
                            <g className="engine-flame">
                                <path fill="#E8AB2E" d="M53.1,77.1c-0.6,2.6-4.1,8.3-4.1,8.3s-3.5-5.6-4.1-8.3c-0.6-2.8-0.1-5.4,1.3-6.7c1.3-1.4,2.8-3.2,2.8-2.7     c0-0.5,1.5,1.3,2.8,2.7C53.1,71.7,53.7,74.3,53.1,77.1z" />
                                <path fill="#FF0000" d="M50.5,76.9c-0.2,1.7-1.5,5.4-1.5,5.4s-1.3-3.7-1.5-5.4c-0.2-1.8,0-3.5,0.5-4.4c0.5-0.9,1-2.1,1-1.8     c0-0.3,0.6,0.9,1,1.8C50.5,73.4,50.7,75,50.5,76.9z" />
                            </g>

                            {/* Fuselage Main */}
                            <path fill="#C1C1C1" d="M58.5,28.5C56.1,22.6,49,14.6,49,14.6v0c0,0-7.1,8-9.5,13.9C37,34.4,33.7,51,42.3,72.2H49v0h6.7     C64.3,51,61,34.4,58.5,28.5z" />

                            {/* Cockpit/Upper Detail */}
                            <path fill="#294862" d="M59.4,31c-2.2-0.5-6-0.9-10.4-0.9c-4.4,0-8.2,0.4-10.4,0.9c0.3-1,0.6-1.8,0.9-2.5c2.4-5.8,9.5-13.9,9.5-13.9     v0c0,0,7,8,9.5,13.9C58.8,29.2,59.1,30,59.4,31z" />
                            <path fill="#FF0000" d="M59.4,31c-2.2-0.5-6-0.9-10.4-0.9c-4.4,0-8.2,0.4-10.4,0.9c0.3-0.9,0.5-1.6,0.8-2.3c2.2-0.9,5.7-1.4,9.6-1.4     c3.9,0,7.3,0.5,9.6,1.4C58.9,29.4,59.1,30.1,59.4,31z" />

                            {/* Details/Windows */}
                            <ellipse fill="#294862" cx="49" cy="66.7" rx="1.6" ry="9.4" />
                            <circle fill="#E5AC2E" cx="49" cy="41.3" r="5.5" />
                            <circle fill="#294862" cx="49" cy="41.3" r="4.2" />
                        </g>
                    </svg>
                </div>
            </div>

            <div className="relative z-20 mt-12 text-center w-full max-w-md px-8">


                {/* Progress Bar */}
                <div className="w-full bg-gray-800/50 rounded-full h-4 mb-4 overflow-hidden border border-blue-500/30 shadow-lg">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-300 ease-out shadow-inner"
                        style={{ width: `${progress}%` }}
                    >
                        <div className="h-full w-full bg-white/20 animate-pulse"></div>
                    </div>
                </div>

                {/* Percentage */}
                <div className="text-2xl font-bold text-white mb-3 tabular-nums">
                    {Math.round(progress)}%
                </div>

                {/* Loading Message */}
                <div className="text-sm text-blue-300 font-medium min-h-[40px] flex items-center justify-center animate-fade-in">
                    {currentMessage}
                </div>

                <div className="flex justify-center mt-4 space-x-1">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                </div>
            </div>

            <style>{`
                .perspective-container {
                    perspective: 500px;
                }
                
                .neon-trail {
                    position: absolute;
                    left: 110%; /* Start off screen right */
                    animation: trail-move linear infinite;
                    border-radius: 999px;
                    box-shadow: 0 0 8px currentColor;
                }

                @keyframes trail-move {
                    0% {
                        left: 110%;
                    }
                    100% {
                        left: -50%;
                    }
                }

                /* Rocket slightly bobbing up and down while flying forward */
                @keyframes rocket-flight {
                    0% { transform: translateY(0px) translateX(0px); }
                    25% { transform: translateY(-5px) translateX(2px); }
                    50% { transform: translateY(0px) translateX(0px); }
                    75% { transform: translateY(5px) translateX(-2px); }
                    100% { transform: translateY(0px) translateX(0px); }
                }

                .animate-rocket-flight {
                    animation: rocket-flight 2s ease-in-out infinite;
                }

                /* Engine flame flickering */
                @keyframes flame-pulse {
                    0% { transform: scaleY(1); opacity: 0.9; }
                    50% { transform: scaleY(1.2); opacity: 1; }
                    100% { transform: scaleY(0.9); opacity: 0.8; }
                }
                
                .engine-flame {
                    transform-origin: center top;
                    transform-box: fill-box;
                    animation: flame-pulse 0.1s infinite alternate;
                }

                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .animate-fade-in {
                    animation: fade-in 0.5s ease-in;
                }

            `}</style>
        </div>
    );
};
