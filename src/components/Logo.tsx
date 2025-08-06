export default function Logo() {
  return (
    <div className="flex items-center justify-center">
      <div className="relative">
        {/* Background circle */}
        <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-800 rounded-full flex items-center justify-center shadow-lg">
          {/* Number 5 */}
          <span className="text-white text-3xl font-bold">5</span>
        </div>
        {/* News indicator */}
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xs font-bold">NEWS</span>
        </div>
      </div>
      <div className="ml-4">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
          News
        </h1>
      </div>
    </div>
  );
}
