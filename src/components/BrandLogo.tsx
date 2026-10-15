import Image from 'next/image';
export function BrandLogo({size=48}:{size?:number}){
 return <span className="brand-logo" style={{width:size,height:size}}>
  <Image src="/kasa-logo-white.png" width={size} height={size} alt="KASA official shield logo" priority={size>=44}/>
 </span>;
}
