import { useAuth } from '../contexts/AuthContext';
import type { User } from '../types';

interface LoginModalProps {
  onLogin?: (user: User) => void;
}

const LoginModal: React.FC<LoginModalProps> = () => {
  const { login, availableUsers } = useAuth();

  const handleUserSelect = (user: User) => {
    login(user.id);
  };

  return (
    <div className='fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50'>
      <div className='bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-8 w-full max-w-md transform transition-all'>
        <div className='text-center mb-8'>
          <h2 className='text-3xl font-bold text-gray-900 dark:text-white mb-2'>
            Welcome Back
          </h2>
          <p className='text-gray-500 dark:text-gray-400'>
            Select a user to continue
          </p>
        </div>

        <div className='space-y-3'>
          {availableUsers.map((user) => (
            <button
              key={user.id}
              onClick={() => handleUserSelect(user)}
              className='w-full group flex items-center p-4 bg-gray-50 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl border border-gray-100 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all duration-200'
            >
              <div
                className='w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-lg shadow-sm'
                style={{ backgroundColor: user.avatar_color || '#3B82F6' }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className='ml-4 text-left'>
                <p className='font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors'>
                  {user.name}
                </p>
                <p className='text-xs text-gray-400 dark:text-gray-500'>
                  User ID: {user.id}
                </p>
              </div>
              <div className='ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-blue-500'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  className='h-5 w-5'
                  viewBox='0 0 20 20'
                  fill='currentColor'
                >
                  <path
                    fillRule='evenodd'
                    d='M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z'
                    clipRule='evenodd'
                  />
                </svg>
              </div>
            </button>
          ))}
        </div>

        <div className='mt-8 text-center text-xs text-gray-400'></div>
      </div>
    </div>
  );
};

export default LoginModal;
