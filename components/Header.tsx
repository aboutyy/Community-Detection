import React from 'react';

type Theme = 'light' | 'dark';

interface HeaderProps {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

const Header: React.FC<HeaderProps> = ({ theme, setTheme }) => {
    return (
        <header className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/50 px-4 py-2 flex justify-between items-center">
            <h1 className="text-xl font-bold text-cyan-600 dark:text-cyan-400">
                交互式社区发现可视化工具
            </h1>
            <div className="flex items-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-3 hidden sm:block">风格</span>
                <button
                    onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                    className="relative inline-flex items-center h-8 w-14 p-1 rounded-full bg-gray-200 dark:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    aria-label="Toggle theme"
                >
                    <span className="sr-only">Toggle theme</span>
                    <span
                        className={`${theme === 'light' ? 'translate-x-0' : 'translate-x-6'
                            } inline-flex items-center justify-center w-6 h-6 transform bg-white rounded-full transition-transform`}
                    >
                        {theme === 'light' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.121-3.536a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM10 18a1 1 0 01-1-1v-1a1 1 0 112 0v1a1 1 0 01-1 1zM5.05 15.657a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zm-3.536-2.121a1 1 0 011.414 0l.707.707a1 1 0 11-1.414 1.414l-.707-.707a1 1 0 010-1.414zM6.343 5.05a1 1 0 00-1.414 1.414l.707.707a1 1 0 001.414-1.414l-.707-.707z" clipRule="evenodd" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                            </svg>
                        )}
                    </span>
                </button>
            </div>
        </header>
    );
};

export default Header;
