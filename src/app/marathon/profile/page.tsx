import Link from 'next/link';
import {ArrowLeft} from 'lucide-react';
import ProfilePage from '@/app/(portal)/dashboard/profile/page';
export default function MarathonProfilePage(){
 return <main style={{background:'#f5f8f5',minHeight:'100vh',padding:'clamp(16px,4vw,45px)'}}>
  <div style={{maxWidth:1200,margin:'0 auto'}}>
   <p><Link href="/marathon" className="btn btn-outline"><ArrowLeft size={16}/> Back to Marathon</Link></p>
   <ProfilePage/>
  </div>
 </main>;
}
