'use client';
import {useEffect,useState} from 'react';
import Image from 'next/image';
import {EmailAuthProvider,reauthenticateWithCredential,sendPasswordResetEmail,updatePassword} from 'firebase/auth';
import {User,Phone,MapPin,Lock,Save,KeyRound,Copy,Check,ShieldCheck,CheckCircle2,Sparkles,ExternalLink} from 'lucide-react';
import {api,PageHeader} from '@/components/Portal';
import {PasswordInput} from '@/components/PasswordInput';
import {requireClientAuth} from '@/lib/firebase-client';
import type {Profile} from '@/lib/types';

export default function ProfilePage(){
  const [profile,setProfile]=useState<Profile|null>(null);
  const [authUser,setAuthUser]=useState<{email:string;emailVerified:boolean;creationTime:string|null;lastSignInTime:string|null}|null>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
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
  const [emailAlerts,setEmailAlerts]=useState(true);
  const [newsUpdates,setNewsUpdates]=useState(true);
  const [smsAlerts,setSmsAlerts]=useState(false);

  // Password fields
  const [currentPassword,setCurrentPassword]=useState('');
  const [newPassword,setNewPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [passwordBusy,setPasswordBusy]=useState(false);
  const [passwordMsg,setPasswordMsg]=useState('');
  const [passwordErr,setPasswordErr]=useState('');
  const [copiedCode,setCopiedCode]=useState(false);

  useEffect(()=>{
    async function loadProfile(){
      try{
        setLoading(true);
        const data = await api<{profile:Profile;authUser:{email:string;emailVerified:boolean;creationTime:string|null;lastSignInTime:string|null}}>('/api/profile');
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
        if(data.profile.notifications){
          setEmailAlerts(data.profile.notifications.emailAlerts??true);
          setNewsUpdates(data.profile.notifications.newsUpdates??true);
          setSmsAlerts(data.profile.notifications.smsAlerts??false);
        }
      }catch(e){
        setStatusErr(e instanceof Error?e.message:'Failed to load profile.');
      }finally{
        setLoading(false);
      }
    }
    void loadProfile();
  },[]);

  async function handleSaveProfile(e:React.FormEvent){
    e.preventDefault();
    setStatusErr('');
    setStatusMsg('');
    setSaving(true);
    try{
      if(photoUrl.trim() && !photoUrl.startsWith('https://res.cloudinary.com/') && !photoUrl.startsWith('https://console.cloudinary.com/')){
        throw new Error('Profile photos must strictly be from Cloudinary (https://console.cloudinary.com/app).');
      }

      const res = await api<{ok:boolean;profile:Profile}>('/api/profile',{
        method:'PATCH',
        body:JSON.stringify({
          displayName:name.trim(),
          phone:phone.trim(),
          address:address.trim(),
          district:district.trim(),
          province:province.trim(),
          constituency:constituency.trim(),
          ward:ward.trim(),
          bio:bio.trim(),
          photoUrl:photoUrl.trim(),
          notifications:{
            emailAlerts,
            newsUpdates,
            smsAlerts
          }
        })
      });

      setProfile(res.profile);
      setStatusMsg('Profile details successfully saved.');
    }catch(e){
      setStatusErr(e instanceof Error?e.message:'Failed to save profile.');
    }finally{
      setSaving(false);
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
      const auth = requireClientAuth();
      const user = auth.currentUser;
      if(!user || !user.email){
        throw new Error('You must be signed in to change your password.');
      }

      if(currentPassword){
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
      }

      await updatePassword(user, newPassword);
      setPasswordMsg('Password changed successfully. Use your new password on next sign-in.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }catch(e:any){
      if(e?.code === 'auth/wrong-password' || e?.code === 'auth/invalid-credential'){
        setPasswordErr('The current password entered is incorrect.');
      }else if(e?.code === 'auth/requires-recent-login'){
        setPasswordErr('Please sign out and sign back in before changing your password, or use the email reset link below.');
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
      const auth = requireClientAuth();
      const user = auth.currentUser;
      if(!user?.email) throw new Error('No user email found.');
      await sendPasswordResetEmail(auth, user.email);
      setPasswordMsg(`Password reset instructions sent to ${user.email}. Check your inbox.`);
    }catch(e){
      setPasswordErr(e instanceof Error?e.message:'Unable to send password reset email.');
    }
  }

  function copyAgentCode(){
    if(!profile?.agentCode) return;
    navigator.clipboard.writeText(profile.agentCode);
    setCopiedCode(true);
    setTimeout(()=>setCopiedCode(false),2000);
  }

  if(loading){
    return <main className="page-loader" role="status">Loading profile…</main>;
  }

  return (
    <>
      <PageHeader
        title="My Profile & Account"
        subtitle="Manage your contact details, physical address, password and account settings."
      />

      <div className="profile-shell-grid">
        {/* Left Card: Summary & Visual Overview */}
        <aside className="profile-card-sticky">
          <div className="profile-avatar-wrap">
            {photoUrl ? (
              <Image
                src={photoUrl}
                alt={name || 'Profile'}
                width={96}
                height={96}
                unoptimized
                className="profile-avatar-img"
              />
            ) : (
              <div className="profile-avatar-placeholder">
                {(name || profile?.email || 'U')[0].toUpperCase()}
              </div>
            )}
          </div>

          <h2 className="profile-name-title">{name || profile?.displayName || 'User'}</h2>
          <div style={{color:'var(--muted)',fontSize:'13px',marginBottom:'6px'}}>{profile?.email}</div>

          <div>
            <span className="profile-role-badge">
              <ShieldCheck size={14}/> {profile?.role?.replace('_',' ')}
            </span>
          </div>

          {profile?.agentCode && (
            <div style={{background:'#f6f9f7',border:'1px dashed #bdd3c7',borderRadius:'8px',padding:'10px',margin:'12px 0'}}>
              <span style={{fontSize:'10px',color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.06em',fontWeight:750,display:'block',marginBottom:'4px'}}>Agent Reference Code</span>
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
                <strong style={{color:'var(--green)',fontFamily:'monospace',fontSize:'14px'}}>{profile.agentCode}</strong>
                <button
                  type="button"
                  onClick={copyAgentCode}
                  title="Copy agent code"
                  style={{border:'none',background:'transparent',cursor:'pointer',color:'var(--green)',padding:'2px'}}
                >
                  {copiedCode ? <Check size={16} color="#15653b"/> : <Copy size={16}/>}
                </button>
              </div>
            </div>
          )}

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

        {/* Right Area: Forms */}
        <div>
          {/* Section 1: Personal & Contact Information */}
          <section className="profile-section-card">
            <h2><User size={20} color="var(--green)"/> Personal & Contact Information</h2>
            <p>Update your institutional name, phone number, residential address and district placement.</p>

            <form onSubmit={handleSaveProfile}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="pf-name">Full name <span className="required">*</span></label>
                  <input
                    id="pf-name"
                    value={name}
                    onChange={e=>setName(e.target.value)}
                    placeholder="e.g. Chanda Mwila"
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="pf-phone">Phone number</label>
                  <input
                    id="pf-phone"
                    type="tel"
                    value={phone}
                    onChange={e=>setPhone(e.target.value)}
                    placeholder="e.g. +260 97 1234567"
                  />
                  <span className="field-hint">Used for WhatsApp and SMS application notifications</span>
                </div>

                <div className="field full">
                  <label htmlFor="pf-address">Residential / Physical Address</label>
                  <input
                    id="pf-address"
                    value={address}
                    onChange={e=>setAddress(e.target.value)}
                    placeholder="e.g. Plot 412, Off Great East Road, Lusaka"
                  />
                </div>

                <div className="field">
                  <label htmlFor="pf-district">District</label>
                  <input
                    id="pf-district"
                    value={district}
                    onChange={e=>setDistrict(e.target.value)}
                    placeholder="e.g. Chibombo, Lusaka, Kitwe"
                  />
                </div>

                <div className="field">
                  <label htmlFor="pf-province">Province</label>
                  <input
                    id="pf-province"
                    value={province}
                    onChange={e=>setProvince(e.target.value)}
                    placeholder="e.g. Central, Lusaka, Copperbelt"
                  />
                </div>

                <div className="field">
                  <label htmlFor="pf-constituency">Constituency</label>
                  <input
                    id="pf-constituency"
                    value={constituency}
                    onChange={e=>setConstituency(e.target.value)}
                    placeholder="e.g. Katuba, Mandevu"
                  />
                </div>

                <div className="field">
                  <label htmlFor="pf-ward">Ward</label>
                  <input
                    id="pf-ward"
                    value={ward}
                    onChange={e=>setWard(e.target.value)}
                    placeholder="e.g. Ward 6"
                  />
                </div>

                <div className="field full">
                  <label htmlFor="pf-photo">Profile Photo URL (Cloudinary)</label>
                  <input
                    id="pf-photo"
                    type="url"
                    value={photoUrl}
                    onChange={e=>setPhotoUrl(e.target.value)}
                    placeholder="https://res.cloudinary.com/..."
                  />
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'4px'}}>
                    <span className="field-hint">Strictly Cloudinary image URLs are accepted.</span>
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

                <div className="field full">
                  <label htmlFor="pf-bio">Short Bio / Position description</label>
                  <textarea
                    id="pf-bio"
                    rows={3}
                    value={bio}
                    onChange={e=>setBio(e.target.value)}
                    placeholder="Tell us about your background or role within the KASA network…"
                  />
                </div>
              </div>

              {statusErr && <div className="alert-error" role="alert">{statusErr}</div>}
              {statusMsg && <div className="notice" role="status">{statusMsg}</div>}

              <div className="profile-actions-bar">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Save size={16}/> {saving ? 'Saving changes…' : 'Save profile'}
                </button>
              </div>
            </form>
          </section>

          {/* Section 2: Password & Account Security */}
          <section className="profile-section-card">
            <h2><KeyRound size={20} color="var(--green)"/> Security & Password</h2>
            <p>Update your password with the view toggle or request an authorized reset link.</p>

            <form onSubmit={handlePasswordChange}>
              <div className="form-grid">
                <div className="field full">
                  <PasswordInput
                    label="Current password"
                    name="current-password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={e=>setCurrentPassword(e.target.value)}
                    placeholder="Enter current password if known"
                    hint="Required to verify your identity for immediate password change."
                  />
                </div>

                <div className="field">
                  <PasswordInput
                    label="New password"
                    name="new-password"
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
                    name="confirm-password"
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
                  Send password reset to email
                </button>

                <button type="submit" className="btn btn-primary" disabled={passwordBusy || !newPassword}>
                  <Lock size={16}/> {passwordBusy ? 'Updating password…' : 'Change password'}
                </button>
              </div>
            </form>
          </section>

          {/* Section 3: Notification Preferences */}
          <section className="profile-section-card">
            <h2><Sparkles size={20} color="var(--green)"/> Notification Preferences</h2>
            <p>Choose which updates and alerts you wish to receive from KASA.</p>

            <div className="choice-stack">
              <label className="choice">
                <input
                  type="checkbox"
                  checked={emailAlerts}
                  onChange={e=>setEmailAlerts(e.target.checked)}
                />
                <div>
                  <strong>Email notifications</strong>
                  <div style={{color:'var(--muted)',fontSize:'12px'}}>Receive important admissions, approvals, and commission updates.</div>
                </div>
              </label>

              <label className="choice">
                <input
                  type="checkbox"
                  checked={newsUpdates}
                  onChange={e=>setNewsUpdates(e.target.checked)}
                />
                <div>
                  <strong>News & Announcements</strong>
                  <div style={{color:'var(--muted)',fontSize:'12px'}}>Stay informed about new 2027 district intakes, bursaries, and campus news.</div>
                </div>
              </label>

              <label className="choice">
                <input
                  type="checkbox"
                  checked={smsAlerts}
                  onChange={e=>setSmsAlerts(e.target.checked)}
                />
                <div>
                  <strong>SMS / WhatsApp alerts</strong>
                  <div style={{color:'var(--muted)',fontSize:'12px'}}>Direct mobile SMS alerts when your phone number is verified.</div>
                </div>
              </label>
            </div>

            <div className="profile-actions-bar">
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving}
                onClick={e=>void handleSaveProfile(e)}
              >
                <Save size={16}/> Save preferences
              </button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
