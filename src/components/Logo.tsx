export default function Logo() {
  return (
    <div className="flex items-center justify-center">
      <div className="relative">
        {/* Main background circle with animation */}
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-blue-600 to-purple-700 rounded-full flex items-center justify-center shadow-2xl transform hover:scale-110 transition-transform duration-300">
          {/* Number 5 with bold styling */}
          <span className="text-white text-4xl font-black">5</span>
        </div>

        {/* Animated news indicator */}
        <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center shadow-lg animate-bounce">
          <span className="text-white text-xs font-black tracking-tight">
            NEWS
          </span>
        </div>

        {/* Additional visual elements */}
        <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-yellow-400 rounded-full animate-ping"></div>
        <div className="absolute top-1 -left-1 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
      </div>

      <div className="ml-6">
        <h1 className="text-5xl font-black text-gray-900 dark:text-white tracking-tight">
          NEWS
        </h1>
        <div className="h-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mt-1"></div>
      </div>
    </div>
  );
}
