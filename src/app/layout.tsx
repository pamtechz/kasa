import './globals.css';
import type {Metadata} from 'next';
export const metadata:Metadata={title:'KASA | Enrollment Network',description:'Kamaila Academics, Sports and Apprenticeship enrollment and district agents portal'};
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en"><body>{children}</body></html>;
}
