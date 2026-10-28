import type {Metadata} from 'next';
import {Suspense} from 'react';
import '../marthon/marathon.css';
import {MarathonOfflineWorker} from '@/components/marathon/MarathonOfflineWorker';
import {MarathonContentSwitch} from '@/components/marathon/MarathonContentSwitch';

export const metadata:Metadata={title:'KASA Life Marathon | Operations',description:'Secure event planning, execution and checklist tracking for KASA Life Marathon'};
export default function MarathonLayout({children}:{children:React.ReactNode}){
 return <><MarathonOfflineWorker/><Suspense fallback={<main className="ml-init" role="status">Opening Marathon operations…</main>}><MarathonContentSwitch>{children}</MarathonContentSwitch></Suspense></>;
}
