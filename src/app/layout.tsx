import type { Metadata } from 'next';
import {
  Inter,
  Comic_Neue,
  Architects_Daughter,
  Bubblegum_Sans,
  Indie_Flower
} from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true
});

const comicNeue = Comic_Neue({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  variable: '--font-comic-neue',
  display: 'swap',
  preload: true
});

const architectsDaughter = Architects_Daughter({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-architects-daughter',
  display: 'swap',
  preload: true
});

const bubblegumSans = Bubblegum_Sans({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-bubblegum-sans',
  display: 'swap',
  preload: true
});

const indieFlower = Indie_Flower({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-indie-flower',
  display: 'swap',
  preload: true
});

const eraser = localFont({
  src: '../../public/fonts/EraserRegular.ttf',
  variable: '--font-eraser',
  display: 'swap',
  preload: true
});

export const metadata: Metadata = {
  title: '5News - News Explained Simply',
  description: 'Get the top news headlines explained in simple terms',
  icons: {
    icon: '/favicon.svg'
  }
};

export default function RootLayout({ children }: { children: any }) {
  return (
    <html lang="en">
      <head>
        {/* Font loading optimization script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Font loading optimization
              if ('fonts' in document) {
                Promise.all([
                  document.fonts.load('1em Eraser'),
                  document.fonts.load('300 1em Comic Neue'),
                  document.fonts.load('400 1em Comic Neue'),
                  document.fonts.load('700 1em Comic Neue'),
                  document.fonts.load('400 1em Architects Daughter'),
                  document.fonts.load('400 1em Bubblegum Sans'),
                  document.fonts.load('400 1em Indie Flower')
                ]).then(() => {
                  document.documentElement.classList.add('fonts-loaded');
                }).catch(() => {
                  // Fallback if any font fails to load
                  setTimeout(() => {
                    document.documentElement.classList.add('fonts-loaded');
                  }, 100);
                });
              } else {
                // Fallback for older browsers
                setTimeout(() => {
                  document.documentElement.classList.add('fonts-loaded');
                }, 100);
              }
            `
          }}
        />
      </head>
      <body
        className={`${inter.className} ${comicNeue.variable} ${architectsDaughter.variable} ${bubblegumSans.variable} ${indieFlower.variable} ${eraser.variable}`}>
        {children}
      </body>
    </html>
  );
}
