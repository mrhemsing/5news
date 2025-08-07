import type { Metadata } from 'next';
import { Inter, Comic_Neue } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });
const comicNeue = Comic_Neue({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  variable: '--font-comic-neue'
});

export const metadata: Metadata = {
  title: '5News - News Explained Simply',
  description: 'Get the top news headlines explained in simple terms',
  icons: {
    icon: '/favicon.svg'
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${comicNeue.variable}`}>
        {children}
      </body>
    </html>
  );
}
