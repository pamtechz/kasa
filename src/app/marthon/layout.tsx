import type {Metadata} from 'next';
import './marathon.css';
import {MarathonOfflineWorker} from '@/components/marathon/MarathonOfflineWorker';
export const metadata:Metadata={title:'KASA Life | Marathon Operations',description:'Secure event planning, execution and checklist tracker for KASA Life Marathon'};
export default function MarathonLayout({children}:{children:React.ReactNode}){return <><MarathonOfflineWorker/>{children}</>;}
