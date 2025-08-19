export default function Logo() {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="flex items-center justify-center relative z-10">
        <div className="relative">
          {/* Main background circle with animation */}
          <div className="blue-ball w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-blue-500 via-blue-600 to-purple-700 rounded-full flex items-center justify-center shadow-2xl transform hover:scale-110 transition-transform duration-300">
            {/* Number 5+ with bold styling */}
            <span className="text-white text-2xl md:text-4xl font-black">
              5+
            </span>
          </div>

          {/* Animated news indicator */}
          <div className="absolute -top-2 -right-1 w-5 h-5 md:w-7 md:h-7 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center shadow-lg bounce-twice">
            <img src="/newz.svg" alt="NEWZ" className="w-3 h-3 md:w-4 md:h-4" />
          </div>
        </div>

        <div className="ml-3 md:ml-6 blocks-wrapper">
          <div className="flex items-center gap-2 md:gap-3 mb-2">
            {/* Wooden letter blocks for ABC */}
            <div className="flex gap-1 md:gap-2">
              {/* Block A - Light Wood */}
              <div
                className="w-20 h-20 md:w-24 md:h-24 rounded-lg shadow-lg transform rotate-1 hover:rotate-0 transition-transform duration-300 flex items-center justify-center border-2"
                style={{
                  background:
                    'linear-gradient(135deg, #D2B48C 0%, #DEB887 50%, #F5DEB3 100%)',
                  boxShadow:
                    '0 8px 16px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.3)',
                  borderColor: '#D2B48C',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                {/* Wood grain texture overlay */}
                <div
                  style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    right: '0',
                    bottom: '0',
                    background:
                      'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(210, 180, 140, 0.1) 2px, rgba(210, 180, 140, 0.1) 4px)',
                    opacity: '0.6'
                  }}></div>
                {/* Colored square background for letter */}
                <div
                  className="w-12 h-12 md:w-14 md:h-14 bg-red-500 rounded flex items-center justify-center shadow-inner"
                  style={{
                    boxShadow:
                      'inset 0 2px 4px rgba(0,0,0,0.3), inset 0 -1px 2px rgba(255,255,255,0.2)',
                    border: '2px solid #dc2626'
                  }}>
                  <span
                    className="text-white font-black text-4xl md:text-5xl"
                    style={{
                      fontFamily:
                        'Arial Black, "Arial Black", "Helvetica Black", "Helvetica", sans-serif',
                      textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                      fontWeight: '900',
                      letterSpacing: '-0.05em'
                    }}>
                    A
                  </span>
                </div>
              </div>

              {/* Block B - Light Wood */}
              <div
                className="w-20 h-20 md:w-24 md:h-24 rounded-lg shadow-lg transform -rotate-2 hover:rotate-0 transition-transform duration-300 flex items-center justify-center border-2"
                style={{
                  background:
                    'linear-gradient(135deg, #D2B48C 0%, #DEB887 50%, #F5DEB3 100%)',
                  boxShadow:
                    '0 8px 16px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.3)',
                  borderColor: '#D2B48C',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                {/* Wood grain texture overlay */}
                <div
                  style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    right: '0',
                    bottom: '0',
                    background:
                      'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(210, 180, 140, 0.1) 2px, rgba(210, 180, 140, 0.1) 4px)',
                    opacity: '0.6'
                  }}></div>
                {/* Colored square background for letter */}
                <div
                  className="w-12 h-12 md:w-14 md:h-14 bg-green-500 rounded flex items-center justify-center shadow-inner"
                  style={{
                    boxShadow:
                      'inset 0 2px 4px rgba(0,0,0,0.3), inset 0 -1px 2px rgba(255,255,255,0.2)',
                    border: '2px solid #16a34a'
                  }}>
                  <span
                    className="text-white font-black text-4xl md:text-5xl"
                    style={{
                      fontFamily:
                        'Arial Black, "Arial Black", "Helvetica Black", "Helvetica", sans-serif',
                      textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                      fontWeight: '900',
                      letterSpacing: '-0.05em'
                    }}>
                    B
                  </span>
                </div>
              </div>

              {/* Block C - Light Wood */}
              <div
                className="w-20 h-20 md:w-24 md:h-24 rounded-lg shadow-lg transform rotate-1 hover:rotate-0 transition-transform duration-300 flex items-center justify-center border-2"
                style={{
                  background:
                    'linear-gradient(135deg, #D2B48C 0%, #DEB887 50%, #F5DEB3 100%)',
                  boxShadow:
                    '0 8px 16px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.3)',
                  borderColor: '#D2B48C',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                {/* Wood grain texture overlay */}
                <div
                  style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    right: '0',
                    bottom: '0',
                    background:
                      'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(45, 90, 45, 0.1) 2px, rgba(45, 90, 45, 0.1) 4px)',
                    opacity: '0.6'
                  }}></div>
                {/* Colored square background for letter */}
                <div
                  className="w-12 h-12 md:w-14 md:h-14 bg-yellow-400 rounded flex items-center justify-center shadow-inner"
                  style={{
                    boxShadow:
                      'inset 0 2px 4px rgba(0,0,0,0.3), inset 0 -1px 2px rgba(255,255,255,0.2)',
                    border: '2px solid #ca8a04'
                  }}>
                  <span
                    className="text-white font-black text-4xl md:text-5xl"
                    style={{
                      fontFamily:
                        'Arial Black, "Arial Black", "Helvetica Black", "Helvetica", sans-serif',
                      textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                      fontWeight: '900',
                      letterSpacing: '-0.05em'
                    }}>
                    C
                  </span>
                </div>
              </div>
            </div>

            {/* NEWS text */}
            <div className="flex flex-col items-start ml-2 md:ml-3">
              <img
                src="/newz.svg"
                alt="NEWZ"
                className="h-8 md:h-12 w-auto news-text logo-newz"
                style={{
                  filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.1))'
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
