'use client';
import {usePathname} from 'next/navigation';
import {MarathonWorkspace} from '@/components/marathon/MarathonWorkspace';
/** Full-page editors must replace the workspace instead of mounting under it. */
export function MarathonContentSwitch({children}:{children:React.ReactNode}){
 const path=usePathname();
 if(path==='/marathon/profile'||/^\/marathon\/settings\/members\/[A-Za-z0-9_-]+$/.test(path))return <>{children}</>;
 return <><MarathonWorkspace/>{children}</>;
}
