import './globals.css';
import type {Metadata, Viewport} from 'next';
import {PwaRegister} from '@/components/PwaRegister';

export const viewport: Viewport = {
  themeColor: '#103f2c',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1
};

export const metadata: Metadata = {
  title: 'KASA | Enrollment Network',
  description: 'Kamaila Academics, Sports and Apprenticeship enrollment and district agents portal',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'KASA'
  }
};

export default function RootLayout({children}:{children:React.ReactNode}){
 return (
  <html lang="en">
   <body suppressHydrationWarning>
    <PwaRegister />
    {children}
   </body>
  </html>
 );
}
