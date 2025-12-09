// src/components/AlertSettings.js or similar
import React, { useState, useEffect } from 'react';

const API_ENDPOINT = 'https://baha-alert.vercel.app/api';

const AlertSettings = () => {
    const [recipientNumber, setRecipientNumber] = useState('');
    const [currentStatus, setCurrentStatus] = useState('Loading...');

    // 1. Fetch current number when the component loads
    useEffect(() => {
        // You'll need a simple GET endpoint in your Vercel API 
        // that returns the current USER_ALERT_RECIPIENT environment variable value.
        const fetchCurrentRecipient = async () => {
            try {
                // Assuming you set up a GET request to fetch the current recipient number
                const res = await fetch(`${API_ENDPOINT}?config=recipient`);
                const data = await res.json();
                if (data.number) {
                    setRecipientNumber(data.number);
                    setCurrentStatus('Loaded.');
                }
            } catch (error) {
                console.error("Failed to fetch settings:", error);
                setCurrentStatus('Failed to load settings.');
            }
        };
        fetchCurrentRecipient();
    }, []);

    // 2. Handle saving the new number
    const handleSave = async (e) => {
        e.preventDefault();
        setCurrentStatus('Saving...');

        // IMPORTANT: The number must be in E.164 format (+639xxxxxxxxx)
        if (!recipientNumber.startsWith('+') || recipientNumber.length < 10) {
            setCurrentStatus('Error: Number must be in +E.164 format.');
            return;
        }

        try {
            // This POST endpoint must be handled on your Vercel backend 
            // to update the recipient number securely (e.g., in a database or config file).
            const res = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'UPDATE_RECIPIENT',
                    number: recipientNumber,
                }),
            });

            if (res.ok) {
                setCurrentStatus('Saved! Remember to verify this number in Twilio Console.');
            } else {
                setCurrentStatus('Error saving number.');
            }
        } catch (error) {
            setCurrentStatus('Network error during save.');
        }
    };

    return (
        <div className="p-8 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-white mb-6">🔔 Alert Recipient Settings</h2>
            
            <form onSubmit={handleSave} className="space-y-4">
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
                    />
                    <p className="mt-1 text-xs text-slate-500">Example: +639171234567. Must be verified in the Twilio Console.</p>
                </div>

                <div className="flex justify-between items-center pt-2">
                    <span className={`text-sm font-medium ${currentStatus.includes('Error') ? 'text-red-400' : 'text-indigo-400'}`}>
                        Status: {currentStatus}
                    </span>
                    <button
                        type="submit"
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-md transition-colors"
                    >
                        Save Number
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AlertSettings;