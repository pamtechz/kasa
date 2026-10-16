'use client';
import {useEffect,useState} from 'react';
import {onAuthStateChanged,EmailAuthProvider,reauthenticateWithCredential,sendPasswordResetEmail,updatePassword} from 'firebase/auth';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {User,Phone,MapPin,Lock,Save,KeyRound,LogOut,AlertCircle,ShieldCheck,CheckCircle2,ExternalLink,ArrowRight} from 'lucide-react';
import {SiteChrome,PageIntro} from '@/components/SiteChrome';
import {auth,authHeaders,firebaseConfigured,signOutClient,requireClientAuth} from '@/lib/firebase-client';
import {PasswordInput} from '@/components/PasswordInput';
import type {Profile} from '@/lib/types';

export default function AccountPage(){
  const [profile,setProfile]=useState<Profile|null>(null);
  const [authUser,setAuthUser]=useState<{email:string;emailVerified:boolean;creationTime:string|null;lastSignInTime:string|null}|null>(null);
  const [sessionState,setSessionState]=useState<'checking'|'guest'|'ready'|'unavailable'>('checking');
  const [busy,setBusy]=useState(false);
  const [statusMsg,setStatusMsg]=useState('');
  const [statusErr,setStatusErr]=useState('');

  // Editable fields
  const [name,setName]=useState('');
  const [phone,setPhone]=useState('');
  const [address,setAddress]=useState('');
  const [district,setDistrict]=useState('');
  const [province,setProvince]=useState('');
  const [constituency,setConstituency]=useState('');
  const [ward,setWard]=useState('');
  const [bio,setBio]=useState('');
  const [photoUrl,setPhotoUrl]=useState('');

  // Password fields
  const [currentPassword,setCurrentPassword]=useState('');
  const [newPassword,setNewPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [passwordBusy,setPasswordBusy]=useState(false);
  const [passwordMsg,setPasswordMsg]=useState('');
  const [passwordErr,setPasswordErr]=useState('');

  const router=useRouter();

  async function loadProfile(){
    try{
      const headers=await authHeaders();
      const res=await fetch('/api/profile',{headers,cache:'no-store'});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||'Failed to load profile.');
      setProfile(data.profile);
      setAuthUser(data.authUser);
      setName(data.profile.displayName||'');
      setPhone(data.profile.phone||'');
      setAddress(data.profile.address||'');
      setDistrict(data.profile.district||'');
      setProvince(data.profile.province||'');
      setConstituency(data.profile.constituency||'');
      setWard(data.profile.ward||'');
      setBio(data.profile.bio||'');
      setPhotoUrl(data.profile.photoUrl||'');
    }catch(e){
      setStatusErr(e instanceof Error?e.message:'Unable to load profile.');
    }
  }

  useEffect(()=>{
    if(!firebaseConfigured||!auth){setSessionState('unavailable');return;}
    let live=true;
    const unsubscribe=onAuthStateChanged(auth,user=>{
      if(!live)return;
      if(!user){setSessionState('guest');return;}
      if(!user.emailVerified){
        setStatusErr('Please verify your email address to access your account settings.');
        setSessionState('guest');
        return;
      }
      setSessionState('ready');
      void loadProfile();
    },()=>{
      if(live){setSessionState('unavailable');setStatusErr('Unable to verify login session.');}
    });
    return ()=>{live=false;unsubscribe();};
  },[]);

  async function logout(){
    setBusy(true);
    try{
      await signOutClient();
      setSessionState('guest');
      router.replace('/login');
    }catch(e){
      setStatusErr(e instanceof Error?e.message:'Unable to sign out.');
    }finally{
      setBusy(false);
    }
  }

  async function handleSaveProfile(e:React.FormEvent){
    e.preventDefault();
    setStatusErr('');
    setStatusMsg('');
    setBusy(true);
    try{
      if(photoUrl.trim() && !photoUrl.startsWith('https://res.cloudinary.com/') && !photoUrl.startsWith('https://console.cloudinary.com/')){
        throw new Error('Profile photos must strictly be uploaded to Cloudinary (https://console.cloudinary.com/app).');
      }

      const headers=await authHeaders();
      const res=await fetch('/api/profile',{
        method:'PATCH',
        headers:{...headers,'Content-Type':'application/json'},
        body:JSON.stringify({
          displayName:name.trim(),
          phone:phone.trim(),
          address:address.trim(),
          district:district.trim(),
          province:province.trim(),
          constituency:constituency.trim(),
          ward:ward.trim(),
          bio:bio.trim(),
          photoUrl:photoUrl.trim()
        })
      });

      const data=await res.json();
      if(!res.ok) throw new Error(data.error||'Failed to save profile.');
      setProfile(data.profile);
      setStatusMsg('Profile details successfully updated.');
    }catch(e){
      setStatusErr(e instanceof Error?e.message:'Failed to update profile.');
    }finally{
      setBusy(false);
    }
  }

  async function handlePasswordChange(e:React.FormEvent){
    e.preventDefault();
    setPasswordErr('');
    setPasswordMsg('');

    if(newPassword.length < 8){
      setPasswordErr('New password must be at least 8 characters long.');
      return;
    }
    if(newPassword !== confirmPassword){
      setPasswordErr('New password and confirmation do not match.');
      return;
    }

    setPasswordBusy(true);
    try{
      const clientAuth = requireClientAuth();
      const user = clientAuth.currentUser;
      if(!user || !user.email) throw new Error('You must be signed in to change your password.');

      if(currentPassword){
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
      }

      await updatePassword(user, newPassword);
      setPasswordMsg('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }catch(e:any){
      if(e?.code === 'auth/wrong-password' || e?.code === 'auth/invalid-credential'){
        setPasswordErr('The current password entered is incorrect.');
      }else if(e?.code === 'auth/requires-recent-login'){
        setPasswordErr('Please sign out and sign back in, or use the email reset link below.');
      }else{
        setPasswordErr(e instanceof Error?e.message:'Failed to update password.');
      }
    }finally{
      setPasswordBusy(false);
    }
  }

  async function handleSendResetEmail(){
    setPasswordErr('');
    setPasswordMsg('');
    try{
      const clientAuth = requireClientAuth();
      const user = clientAuth.currentUser;
      if(!user?.email) throw new Error('No user email found.');
      await sendPasswordResetEmail(clientAuth, user.email);
      setPasswordMsg(`Password reset instructions sent to ${user.email}. Check your inbox.`);
    }catch(e){
      setPasswordErr(e instanceof Error?e.message:'Unable to send password reset email.');
    }
  }

  return (
    <SiteChrome>
      <PageIntro
        eyebrow="ACCOUNT MANAGEMENT"
        title="Manage profile & account"
        description="Update your contact phone number, residential address, district and secure password."
      />

      <main className="container site-content">
        {sessionState==='checking'&&<section className="panel pad-panel" role="status"><p>Checking your secure session…</p></section>}
        {sessionState==='unavailable'&&<section className="panel pad-panel" role="alert">
          <AlertCircle size={26}/><h2>Account service unavailable</h2>
          <p>Firebase Authentication is not configured or could not be reached.</p>
          <div className="inline-form">
            <Link className="btn btn-primary" href="/login?next=%2Faccount">Sign in</Link>
          </div>
        </section>}
        {sessionState==='guest'&&<section className="panel pad-panel">
          <ShieldCheck size={28}/><h2>Sign in to manage your account</h2>
          <p>Please sign in to access your personal profile and account settings.</p>
          {statusErr&&<p className="alert-error">{statusErr}</p>}
          <Link className="btn btn-primary" href="/login?next=%2Faccount">Sign in or create account <ArrowRight size={16}/></Link>
        </section>}

        {sessionState==='ready'&&<>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px',flexWrap:'wrap',gap:'12px'}}>
            <div className="inline-form" style={{margin:0}}>
              <Link href="/my-applications" className="btn btn-outline">← Back to My Applications</Link>
            </div>
            <button type="button" className="btn btn-outline" disabled={busy} onClick={()=>void logout()}>
              <LogOut size={16}/> Sign out
            </button>
          </div>

          <div className="profile-shell-grid">
            <aside className="profile-card-sticky">
              <div className="profile-avatar-wrap">
                <div className="profile-avatar-placeholder">
                  {(name || profile?.email || 'U')[0].toUpperCase()}
                </div>
              </div>

              <h2 className="profile-name-title">{name || profile?.displayName || 'Student'}</h2>
              <div style={{color:'var(--muted)',fontSize:'13px',marginBottom:'8px'}}>{profile?.email}</div>

              <div>
                <span className="profile-role-badge">
                  <ShieldCheck size={14}/> {profile?.role?.replace('_',' ') || 'Student'}
                </span>
              </div>

              <div className="profile-meta-list">
                <div className="profile-meta-row">
                  <span>Email verification</span>
                  {authUser?.emailVerified ? (
                    <span className="badge-pill-verified"><CheckCircle2 size={12}/> Verified</span>
                  ) : (
                    <span className="badge-pill-unverified">Unverified</span>
                  )}
                </div>
                {district && (
                  <div className="profile-meta-row">
                    <span>District</span>
                    <strong>{district}</strong>
                  </div>
                )}
                {province && (
                  <div className="profile-meta-row">
                    <span>Province</span>
                    <strong>{province}</strong>
                  </div>
                )}
                {authUser?.creationTime && (
                  <div className="profile-meta-row">
                    <span>Member since</span>
                    <strong>{new Date(authUser.creationTime).toLocaleDateString()}</strong>
                  </div>
                )}
              </div>
            </aside>

            <div>
              {/* Personal Details */}
              <section className="profile-section-card">
                <h2><User size={20} color="var(--green)"/> Profile & Contact Details</h2>
                <p>Keep your phone number and physical address up-to-date for your applications.</p>

                <form onSubmit={handleSaveProfile}>
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="stu-name">Full Name <span className="required">*</span></label>
                      <input
                        id="stu-name"
                        value={name}
                        onChange={e=>setName(e.target.value)}
                        placeholder="e.g. Kondwani Tembo"
                        required
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="stu-phone">Phone Number</label>
                      <input
                        id="stu-phone"
                        type="tel"
                        value={phone}
                        onChange={e=>setPhone(e.target.value)}
                        placeholder="e.g. +260 97 1234567"
                      />
                      <span className="field-hint">Used for SMS status alerts and contact</span>
                    </div>

                    <div className="field full">
                      <label htmlFor="stu-address">Residential / Physical Address</label>
                      <input
                        id="stu-address"
                        value={address}
                        onChange={e=>setAddress(e.target.value)}
                        placeholder="e.g. House No. 24, Lusaka Road, Kabwe"
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="stu-district">District</label>
                      <input
                        id="stu-district"
                        value={district}
                        onChange={e=>setDistrict(e.target.value)}
                        placeholder="e.g. Kabwe, Ndola, Lusaka"
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="stu-province">Province</label>
                      <input
                        id="stu-province"
                        value={province}
                        onChange={e=>setProvince(e.target.value)}
                        placeholder="e.g. Central, Copperbelt, Lusaka"
                      />
                    </div>

                    <div className="field full">
                      <label htmlFor="stu-photo">Profile Photo URL (Cloudinary)</label>
                      <input
                        id="stu-photo"
                        type="url"
                        value={photoUrl}
                        onChange={e=>setPhotoUrl(e.target.value)}
                        placeholder="https://res.cloudinary.com/..."
                      />
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'4px'}}>
                        <span className="field-hint">Strictly Cloudinary image URLs are allowed.</span>
                        <a
                          href="https://console.cloudinary.com/app"
                          target="_blank"
                          rel="noreferrer"
                          style={{fontSize:'12px',color:'var(--green)',display:'inline-flex',alignItems:'center',gap:'4px',fontWeight:700}}
                        >
                          Open Cloudinary Console <ExternalLink size={12}/>
                        </a>
                      </div>
                    </div>
                  </div>

                  {statusErr && <div className="alert-error" role="alert">{statusErr}</div>}
                  {statusMsg && <div className="notice" role="status">{statusMsg}</div>}

                  <div className="profile-actions-bar">
                    <button type="submit" className="btn btn-primary" disabled={busy}>
                      <Save size={16}/> {busy ? 'Saving changes…' : 'Save profile'}
                    </button>
                  </div>
                </form>
              </section>

              {/* Password & Security */}
              <section className="profile-section-card">
                <h2><KeyRound size={20} color="var(--green)"/> Password & Security</h2>
                <p>Change your password with view toggle or request a password reset email.</p>

                <form onSubmit={handlePasswordChange}>
                  <div className="form-grid">
                    <div className="field full">
                      <PasswordInput
                        label="Current password"
                        name="stu-current-password"
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={e=>setCurrentPassword(e.target.value)}
                        placeholder="Enter current password if known"
                        hint="Required to verify identity for immediate password change."
                      />
                    </div>

                    <div className="field">
                      <PasswordInput
                        label="New password"
                        name="stu-new-password"
                        autoComplete="new-password"
                        minLength={8}
                        value={newPassword}
                        onChange={e=>setNewPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        required
                      />
                    </div>

                    <div className="field">
                      <PasswordInput
                        label="Confirm new password"
                        name="stu-confirm-password"
                        autoComplete="new-password"
                        minLength={8}
                        value={confirmPassword}
                        onChange={e=>setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        required
                      />
                    </div>
                  </div>

                  {passwordErr && <div className="alert-error" role="alert">{passwordErr}</div>}
                  {passwordMsg && <div className="notice" role="status">{passwordMsg}</div>}

                  <div className="profile-actions-bar" style={{justifyContent:'space-between',flexWrap:'wrap'}}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={handleSendResetEmail}
                    >
                      Send reset link to email
                    </button>

                    <button type="submit" className="btn btn-primary" disabled={passwordBusy || !newPassword}>
                      <Lock size={16}/> {passwordBusy ? 'Updating…' : 'Change password'}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          </div>
        </>}
      </main>
    </SiteChrome>
  );
}
