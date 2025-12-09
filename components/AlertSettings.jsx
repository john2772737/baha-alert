// src/components/AlertSettings.js

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext'; 

const API_ENDPOINT = 'https://baha-alert.vercel.app/api';

const AlertSettings = ({ onClose }) => {
    // ⭐ Get user and loading state from the context
    const { user, loading } = useAuth(); 
    
    // ⭐ Derive the userEmail from the user object
    const userEmail = user && user.email ? user.email : null; 
    
    const [recipientNumber, setRecipientNumber] = useState('');
    const [currentStatus, setCurrentStatus] = useState(loading ? 'Initializing...' : 'Loading...');

    // --- 1. Fetch current number when the component loads ---
    useEffect(() => {
        // Stop if still loading the auth state or if no email is available
        if (loading || !userEmail) {
            if (!loading && !userEmail) {
                 setCurrentStatus('Error: User not logged in.');
            }
            return;
        }
        
        const fetchCurrentRecipient = async () => {
            setCurrentStatus('Fetching saved number...');
            
            try {
                // Fetch recipient using the logged-in email as the unique query ID
                const res = await fetch(`${API_ENDPOINT}?recipient_email=${userEmail}`);
                const data = await res.json();
                
                if (data.success && data.phoneNumber) {
                    setRecipientNumber(data.phoneNumber);
                    setCurrentStatus('Loaded.');
                } else {
                    setRecipientNumber(''); 
                    setCurrentStatus('Ready to save new number.');
                }
            } catch (error) {
                console.error("Failed to fetch settings:", error);
                setCurrentStatus('Failed to connect to server.');
            }
        };
        fetchCurrentRecipient();
    }, [userEmail, loading]);

    // --- 2. Handle saving the new number ---
    // Note: We are using a pure onClick handler, so e.preventDefault() is implicitly handled 
    // by ensuring the button type is NOT "submit".
    const handleSave = async () => {
        // No need for e.preventDefault() since the button type is "button"
        setCurrentStatus('Saving...');

        if (!userEmail) {
             setCurrentStatus('Error: Cannot save, user email missing.');
             return;
        }

        // Validate E.164 format
        if (!recipientNumber.startsWith('+') || recipientNumber.length < 10) {
            setCurrentStatus('Error: Number must be in +E.164 format.');
            return;
        }

        try {
            // POST BODY: Including both phoneNumber and the unique userEmail
            const res = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'UPDATE_RECIPIENT',
                    userEmail: userEmail,
                    phoneNumber: recipientNumber,
                }),
            });

            if (res.ok) {
                const result = await res.json();
                if (result.success) {
                    setCurrentStatus('Saved! Remember to verify this number in Twilio Console.');
                } else {
                    setCurrentStatus(`Error: ${result.error || 'Server rejected save.'}`);
                }
            } else {
                setCurrentStatus('Network error saving number.');
            }
        } catch (error) {
            setCurrentStatus('Network error during save.');
        }
    };

    const isSaving = currentStatus.includes('Saving');
    const isLoggedIn = !!userEmail;
    
   return (
    <div className="bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700 w-full max-w-xl mx-auto relative">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            🔔 Alert Recipient Settings 
            <span className='text-sm text-slate-500 font-normal'>({userEmail || (loading ? 'Loading...' : 'Not Logged In')})</span>
        </h2>
        
        {/* ⭐ FORM: Now primarily a container, submission is handled by the button's onClick */}
        <form className="space-y-4"> 
            <div>
                <label htmlFor="recipient" className="block text-sm font-medium text-slate-400 mb-1">
                    Recipient Phone Number (E.164 format)
                </label>
                <input
                    id="recipient"
                    type="tel"
                    value={recipientNumber}
                    onChange={(e) => setRecipientNumber(e.target.value)}
                    placeholder="+639xxxxxxxxx"
                    className="w-full p-3 rounded-lg bg-slate-700 text-white border border-slate-600 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                    required
                    disabled={!isLoggedIn || isSaving}
                />
                <p className="mt-1 text-xs text-slate-500">Example: +639171234567. This number must be verified in the Twilio Console.</p>
            </div>
            
            <div className="flex justify-between items-center pt-2">
                <span className={`text-sm font-medium ${currentStatus.includes('Error') ? 'text-red-400' : 'text-indigo-400'}`}>
                    Status: {currentStatus}
                </span>
                <div className='space-x-2'>
                     <button
                        type="button" 
                        onClick={onClose}
                        className="px-6 py-2 text-slate-400 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
                    >
                        Close
                    </button>
                    {/* ⭐ SAVE BUTTON: Explicitly calls handleSave on click. */}
                    <button
                        type="button" 
                        onClick={handleSave} 
                        disabled={!isLoggedIn || isSaving}
                        className={`px-6 py-2 font-bold rounded-lg shadow-md transition-colors 
                            ${isLoggedIn && !isSaving ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-500 text-slate-300 cursor-not-allowed'}`}
                    >
                        {isSaving ? 'Saving...' : 'Save Number'}
                    </button>
                </div>
            </div>
        </form>
    </div>
);
};

export default AlertSettings;