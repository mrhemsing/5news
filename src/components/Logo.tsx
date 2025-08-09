export default function Logo() {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="flex items-center justify-center relative z-10">
        <div className="relative">
          {/* Main background circle with animation */}
          <div className="blue-ball w-20 h-20 bg-gradient-to-br from-blue-500 via-blue-600 to-purple-700 rounded-full flex items-center justify-center shadow-2xl transform hover:scale-110 transition-transform duration-300">
            {/* Number 5+ with bold styling */}
            <span className="text-white text-4xl font-black">5+</span>
          </div>

          {/* Animated news indicator */}
          <div className="absolute -top-2 -right-1 w-7 h-7 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center shadow-lg bounce-twice">
            <span
              className="text-white text-[8px] font-black tracking-tight"
              style={{
                fontFamily:
                  'var(--font-comic-neue), "Comic Neue", "Comic Sans MS", cursive'
              }}>
              NEWS
            </span>
          </div>
        </div>

        <div className="ml-6 blocks-wrapper">
          <div className="flex items-center gap-3 mb-2">
            {/* Wooden letter blocks for ABC */}
            <div className="flex gap-2">
              {/* Block A - Light Wood */}
              <div
                className="w-24 h-24 rounded-lg shadow-lg transform rotate-3 hover:rotate-0 transition-transform duration-300 flex items-center justify-center border-2"
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
                  className="w-14 h-14 bg-red-500 rounded flex items-center justify-center shadow-inner"
                  style={{
                    boxShadow:
                      'inset 0 2px 4px rgba(0,0,0,0.3), inset 0 -1px 2px rgba(255,255,255,0.2)',
                    border: '2px solid #dc2626'
                  }}>
                  <span
                    className="text-white font-black text-5xl"
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
                className="w-24 h-24 rounded-lg shadow-lg transform -rotate-2 hover:rotate-0 transition-transform duration-300 flex items-center justify-center border-2"
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
                  className="w-14 h-14 bg-green-500 rounded flex items-center justify-center shadow-inner"
                  style={{
                    boxShadow:
                      'inset 0 2px 4px rgba(0,0,0,0.3), inset 0 -1px 2px rgba(255,255,255,0.2)',
                    border: '2px solid #16a34a'
                  }}>
                  <span
                    className="text-white font-black text-5xl"
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
                className="w-24 h-24 rounded-lg shadow-lg transform rotate-1 hover:rotate-0 transition-transform duration-300 flex items-center justify-center border-2"
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
                  className="w-14 h-14 bg-yellow-400 rounded flex items-center justify-center shadow-inner"
                  style={{
                    boxShadow:
                      'inset 0 2px 4px rgba(0,0,0,0.3), inset 0 -1px 2px rgba(255,255,255,0.2)',
                    border: '2px solid #ca8a04'
                  }}>
                  <span
                    className="text-white font-black text-5xl"
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
            <div className="flex flex-col items-start ml-3">
              <span
                className="text-gray-900 dark:text-white font-black text-4xl news-text"
                style={{
                  fontFamily:
                    'var(--font-architects-daughter), "Architects Daughter", cursive',
                  textShadow: '2px 2px 4px rgba(0,0,0,0.1)'
                }}>
                NEWS
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Chalkboard subtitle */}
      <div
        className="mt-4 px-6 py-3 rounded-lg shadow-lg chalkboard-wrapper relative z-0"
        style={{
          background: 'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)',
          border: '3px solid #4a5568',
          boxShadow:
            '0 4px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
        }}>
        {/* Top left bolt */}
        <div className="absolute top-2 left-2 w-4 h-4 bg-gray-600 rounded-full shadow-lg flex items-center justify-center">
          <div className="w-2 h-2 bg-gray-800 rounded-full"></div>
        </div>

        {/* Top right bolt */}
        <div className="absolute top-2 right-2 w-4 h-4 bg-gray-600 rounded-full shadow-lg flex items-center justify-center">
          <div className="w-2 h-2 bg-gray-800 rounded-full"></div>
        </div>

        <span
          className="text-white font-bold text-xl tracking-wide"
          style={{
            fontFamily:
              '"Eraser", "Indie Flower", "Chalkduster", "Chalkboard", "Comic Sans MS", "Comic Sans", cursive',
            textShadow:
              '2px 2px 4px rgba(0,0,0,0.8), 1px 1px 2px rgba(255,255,255,0.3), 0 0 8px rgba(255,255,255,0.1)',
            color: '#ffffff',
            fontWeight: 'bold',
            letterSpacing: '0.08em',
            transform: 'rotate(-0.5deg)',
            display: 'inline-block',
            lineHeight: '1.2'
          }}>
          <span style={{ transform: 'rotate(1deg)', display: 'inline-block' }}>
            T
          </span>
          <span
            style={{ transform: 'rotate(-0.8deg)', display: 'inline-block' }}>
            O
          </span>
          <span
            style={{ transform: 'rotate(0.3deg)', display: 'inline-block' }}>
            D
          </span>
          <span
            style={{ transform: 'rotate(-0.2deg)', display: 'inline-block' }}>
            A
          </span>
          <span
            style={{ transform: 'rotate(0.7deg)', display: 'inline-block' }}>
            Y
          </span>
          <span
            style={{ transform: 'rotate(-0.4deg)', display: 'inline-block' }}>
            &apos;
          </span>
          <span
            style={{ transform: 'rotate(0.1deg)', display: 'inline-block' }}>
            S
          </span>
          <span
            style={{
              transform: 'rotate(-0.6deg)',
              display: 'inline-block',
              marginRight: '0.3em'
            }}>
            {' '}
          </span>
          <span
            style={{ transform: 'rotate(0.4deg)', display: 'inline-block' }}>
            T
          </span>
          <span
            style={{ transform: 'rotate(-0.3deg)', display: 'inline-block' }}>
            O
          </span>
          <span
            style={{ transform: 'rotate(0.2deg)', display: 'inline-block' }}>
            P
          </span>
          <span
            style={{
              transform: 'rotate(-0.5deg)',
              display: 'inline-block',
              marginRight: '0.3em'
            }}>
            {' '}
          </span>
          <span
            style={{ transform: 'rotate(0.6deg)', display: 'inline-block' }}>
            H
          </span>
          <span
            style={{ transform: 'rotate(-0.2deg)', display: 'inline-block' }}>
            E
          </span>
          <span
            style={{ transform: 'rotate(0.3deg)', display: 'inline-block' }}>
            A
          </span>
          <span
            style={{ transform: 'rotate(-0.4deg)', display: 'inline-block' }}>
            D
          </span>
          <span
            style={{ transform: 'rotate(0.1deg)', display: 'inline-block' }}>
            L
          </span>
          <span
            style={{ transform: 'rotate(-0.7deg)', display: 'inline-block' }}>
            I
          </span>
          <span
            style={{ transform: 'rotate(0.5deg)', display: 'inline-block' }}>
            N
          </span>
          <span
            style={{ transform: 'rotate(-0.3deg)', display: 'inline-block' }}>
            E
          </span>
          <span
            style={{ transform: 'rotate(0.2deg)', display: 'inline-block' }}>
            S
          </span>
          <span
            style={{
              transform: 'rotate(-0.6deg)',
              display: 'inline-block',
              marginRight: '0.3em'
            }}>
            {' '}
          </span>
          <span
            style={{ transform: 'rotate(0.4deg)', display: 'inline-block' }}>
            M
          </span>
          <span
            style={{ transform: 'rotate(-0.1deg)', display: 'inline-block' }}>
            A
          </span>
          <span
            style={{ transform: 'rotate(0.3deg)', display: 'inline-block' }}>
            D
          </span>
          <span
            style={{ transform: 'rotate(-0.5deg)', display: 'inline-block' }}>
            E
          </span>
          <span
            style={{
              transform: 'rotate(0.2deg)',
              display: 'inline-block',
              marginRight: '0.3em'
            }}>
            {' '}
          </span>
          <span
            style={{ transform: 'rotate(-0.4deg)', display: 'inline-block' }}>
            K
          </span>
          <span
            style={{ transform: 'rotate(0.6deg)', display: 'inline-block' }}>
            I
          </span>
          <span
            style={{ transform: 'rotate(-0.3deg)', display: 'inline-block' }}>
            D
          </span>
          <span
            style={{
              transform: 'rotate(0.1deg)',
              display: 'inline-block',
              marginRight: '0.3em'
            }}>
            {' '}
          </span>
          <span
            style={{ transform: 'rotate(-0.7deg)', display: 'inline-block' }}>
            F
          </span>
          <span
            style={{ transform: 'rotate(0.4deg)', display: 'inline-block' }}>
            R
          </span>
          <span
            style={{ transform: 'rotate(-0.2deg)', display: 'inline-block' }}>
            I
          </span>
          <span
            style={{ transform: 'rotate(0.5deg)', display: 'inline-block' }}>
            E
          </span>
          <span
            style={{ transform: 'rotate(-0.3deg)', display: 'inline-block' }}>
            N
          </span>
          <span
            style={{ transform: 'rotate(0.2deg)', display: 'inline-block' }}>
            D
          </span>
          <span
            style={{ transform: 'rotate(-0.6deg)', display: 'inline-block' }}>
            L
          </span>
          <span
            style={{ transform: 'rotate(0.1deg)', display: 'inline-block' }}>
            Y
          </span>
        </span>
      </div>
    </div>
  );
}
