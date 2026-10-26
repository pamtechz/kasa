import {redirect} from 'next/navigation';
/** Marathon uses the exact same Firebase sign-in screen and account as School. */
export default function MarathonLogin(){redirect('/login?next=%2Fmarthon');}
