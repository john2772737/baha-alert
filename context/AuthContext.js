// src/components/AlertSettings.js

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext'; 
import { BellIcon, XCircleIcon, CheckCircleIcon } from '../utils/icons'; 

const API_ENDPOINT = 'https://baha-alert.vercel.app/api';

const AlertSettings = ({ onClose }) => {
    const { user, loading } = useAuth(); 
    const userEmail = user && user.email ? user.email : null; 
    
    const [recipientNumber, setRecipientNumber] = useState('');
    const [currentStatus, setCurrentStatus] = useState(loading ? 'Initializing...' : 'Loading...');
    const [toastMessage, setToastMessage] = useState(null); 

    // --- 1. Fetch current number when the component loads ---
    useEffect(() => {
        if (loading) {
            setCurrentStatus('Initializing...');
            return;
        }
        
        if (!userEmail) {
            setCurrentStatus('Error: User not logged in.');
            return;
        }
        
        const fetchCurrentRecipient = async () => {
            setCurrentStatus('Fetching saved number...');
            setToastMessage(null); // Clear previous messages
            
            try {
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
    const handleSave = async () => {
        setToastMessage(null);
        
        // ⭐ SYNCHRONOUS VALIDATION (Must halt execution immediately)
        if (!userEmail) {
             setToastMessage({ success: false, message: 'User email missing. Cannot save.' });
             setCurrentStatus('Error');
             return;
        }
        if (!recipientNumber || !recipientNumber.startsWith('+') || recipientNumber.length < 10) {
            setToastMessage({ success: false, message: 'Invalid number format. Use +CountryCodeNumber.' });
            setCurrentStatus('Error');
            return; 
        }

        setCurrentStatus('Saving...');
        
        try {
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
                    setToastMessage({ success: true, message: 'Settings saved successfully!' });
                    // ⭐ Success action: Wait briefly then close the modal
                    setTimeout(onClose, 500); 
                    return;
                } else {
                    setToastMessage({ success: false, message: result.error || 'Server rejected save.' });
                    setCurrentStatus('Error');
                }
            } else {
                setToastMessage({ success: false, message: `API Error: ${res.status} ${res.statusText}` });
                setCurrentStatus('Error');
            }
        } catch (error) {
            setToastMessage({ success: false, message: 'Network error during save.' });
            setCurrentStatus('Error');
        }
    };

    const isSaving = currentStatus.includes('Saving');
    const isLoggedIn = !!userEmail;
    const isError = currentStatus.includes('Error');
    
    return (
        <div className="bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700 w-full max-w-xl mx-auto relative">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <BellIcon className='w-6 h-6 text-indigo-400'/>
                Alert Recipient Settings 
                <span className='text-sm text-slate-500 font-normal'>({userEmail || (loading ? 'Loading...' : 'Not Logged In')})</span>
            </h2>
            
            {/* ⭐ TOAST MESSAGE DISPLAY */}
            {toastMessage && (
                <div className={`p-3 mb-4 rounded-lg flex items-center gap-3 font-bold ${
                    toastMessage.success 
                        ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-600'
                        : 'bg-red-900/50 text-red-400 border border-red-600'
                }`}>
                    {toastMessage.success 
                        ? <CheckCircleIcon className='w-5 h-5'/> 
                        : <XCircleIcon className='w-5 h-5'/>
                    }
                    {toastMessage.message}
                </div>
            )}
            
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
                    <p className="mt-1 text-xs text-slate-500">Must be manually verified in the Twilio Console (Free Trial requirement).</p>
                </div>
                
                <div className="flex justify-between items-center pt-2">
                    <span className={`text-sm font-medium ${isError ? 'text-red-400' : 'text-indigo-400'}`}>
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