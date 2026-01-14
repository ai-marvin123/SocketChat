import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';
import type { User, Conversation } from '../types';
import CreateGroupModal from './CreateGroupModal';

const Sidebar: React.FC = () => {
  const { currentUser, logout, availableUsers } = useAuth();
  const { onlineUsers, setCurrentConversation, groups, unreadCounts } = useChat();
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  // Helper to get DM conversation ID
  const getDmConversationId = (targetUserId: string): string => {
    return `dm_${[currentUser!.id, targetUserId].sort().join('_')}`;
  };

  // For now, treat clicking a user as starting a Direct Message conversation
  const handleUserClick = (targetUser: User) => {
    const mockConversation: Conversation = {
        _id: `dm_${[currentUser!.id, targetUser.id].sort().join('_')}`,
        conversation_type: 'DIRECT',
        participants: [currentUser!.id, targetUser.id]
    };
    setCurrentConversation(mockConversation);
  };

  const handleGroupClick = (group: Conversation) => {
    setCurrentConversation(group);
  };

  return (
    <div className="w-80 h-full bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 flex flex-col">
      {/* Header: Current User */}
      <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center">
            <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shadow-sm"
                style={{ backgroundColor: currentUser?.avatar_color || '#3B82F6' }}
            >
                {currentUser?.name.charAt(0).toUpperCase()}
            </div>
            <div className="ml-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                    {currentUser?.name}
                </h3>
                <span className="flex items-center text-xs text-green-500 font-medium">
                    <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5 animate-pulse"></span>
                    Online
                </span>
            </div>
        </div>
        <button 
            onClick={logout}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10"
            title="Logout"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
            </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Groups Section */}
        <div>
          <div className="flex items-center justify-between mb-3 px-2">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Groups
            </h4>
            <button
              onClick={() => setShowCreateGroup(true)}
              className="text-xs text-blue-500 hover:text-blue-600 font-medium"
            >
              + New
            </button>
          </div>
          
          {groups.length === 0 ? (
            <p className="text-xs text-gray-400 px-2">No groups yet</p>
          ) : (
            groups.map((group) => {
              const unreadCount = unreadCounts.get(group._id) || 0;
              
              return (
                <button
                  key={group._id}
                  onClick={() => handleGroupClick(group)}
                  className="w-full flex items-center p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all"
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-medium text-sm">
                      {group.conversation_name?.charAt(0).toUpperCase() || 'G'}
                    </div>
                    {/* Unread Badge */}
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-sm animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="ml-3 text-left flex-1">
                    <p className="font-medium text-gray-900 dark:text-gray-200">
                      {group.conversation_name || 'Unnamed Group'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {group.participants.length} members
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Users List */}
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">
              Direct Messages
          </h4>
          
          {availableUsers
              .filter(u => u.id !== currentUser?.id)
              .map((user) => {
                  const isOnline = onlineUsers.get(user.id) === 'ONLINE';
                  const dmConversationId = getDmConversationId(user.id);
                  const unreadCount = unreadCounts.get(dmConversationId) || 0;

                  return (
                      <button
                          key={user.id}
                          onClick={() => handleUserClick(user)}
                          className="w-full flex items-center p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all group"
                      >
                          <div className="relative">
                              <div
                                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm"
                                  style={{ backgroundColor: user.avatar_color || '#9CA3AF' }}
                              >
                                  {user.name.charAt(0).toUpperCase()}
                              </div>
                              
                              {/* Unread Badge (priority over status) */}
                              {unreadCount > 0 ? (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-sm animate-pulse">
                                  {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                              ) : (
                                /* Status Indicator */
                                <span 
                                    className={`absolute bottom-0 right-0 block w-3 h-3 rounded-full ring-2 ring-white dark:ring-zinc-900 ${
                                        isOnline ? 'bg-green-500' : 'bg-gray-300 dark:bg-zinc-600'
                                    }`}
                                ></span>
                              )}
                          </div>

                          <div className="ml-3 text-left flex-1">
                              <p className="font-medium text-gray-900 dark:text-gray-200">
                                  {user.name}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                  {unreadCount > 0 
                                    ? `${unreadCount} new message${unreadCount > 1 ? 's' : ''}`
                                    : isOnline ? 'Active now' : 'Offline'
                                  }
                              </p>
                          </div>
                      </button>
                  );
              })}
        </div>
      </div>

      {/* Create Group Modal */}
      <CreateGroupModal 
        isOpen={showCreateGroup} 
        onClose={() => setShowCreateGroup(false)} 
      />
    </div>
  );
};

export default Sidebar;
