// src/components/AlertSettings.js

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext'; // ⭐ Import the context hook
// You will need to ensure this path is correct: '../context/AuthContext'
// or adjust it based on where AlertSettings.js is located relative to AuthContext.js

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
    }, [userEmail, loading]); // Depend on userEmail and loading state

    // --- 2. Handle saving the new number ---
    const handleSave = async (e) => {
        e.preventDefault();
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
                    userEmail: userEmail, // ⭐ Pass the email obtained from Firebase Auth
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
    
   // Inside src/components/AlertSettings.js

return (
    <div className="bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700 w-full max-w-xl mx-auto relative">
        {/* ... existing header and status display ... */}
        
        {/* ⭐ Change the form tag: Remove onSubmit, rely on the button click */}
        <form className="space-y-4"> 
            {/* ... form fields ... */}
            
            <div className="flex justify-between items-center pt-2">
                <span className={`text-sm font-medium ${currentStatus.includes('Error') ? 'text-red-400' : 'text-indigo-400'}`}>
                    Status: {currentStatus}
                </span>
                <div className='space-x-2'>
                     <button
                        type="button" // Type MUST be 'button' to avoid native submission
                        onClick={onClose}
                        className="px-6 py-2 text-slate-400 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors"
                    >
                        Close
                    </button>
                    {/* ⭐ Change the save button: Type is 'button', handler is onClick */}
                    <button
                        type="button" // MUST be type="button"
                        onClick={handleSave} // Calls your JS function directly
                        disabled={!isLoggedIn || isSaving}
                        className={`px-6 py-2 font-bold rounded-lg shadow-md transition-colors 
                            ${isLoggedIn ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-500 text-slate-300 cursor-not-allowed'}`}
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