import {Suspense} from 'react';
import {MarathonWorkspace} from '@/components/marathon/MarathonWorkspace';

export default function MarathonWorkspaceLayout({children}:{children:React.ReactNode}){
 return <><Suspense fallback={<div className="ml-init" role="status"><span className="ml-spinner"/><h2>Opening Marathon Command Centre</h2></div>}><MarathonWorkspace/></Suspense>{children}</>;
}
