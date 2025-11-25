import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';

const Nowcast = () => {
    const [nowcastData, setNowcastData] = useState(null);
    const [loading, setLoading] = useState(false);
    const { setAlert } = useAppStore();

    const fetchNowcast = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/nowcast');
            if (!response.ok) {
                throw new Error('Failed to fetch nowcast data');
            }
            const data = await response.json();
            setNowcastData(data);
        } catch (error) {
            setAlert({ message: error.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 bg-gray-800 rounded-lg">
            <h3 className="text-lg font-bold text-white mb-2">Nowcast</h3>
            <button
                onClick={fetchNowcast}
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
                {loading ? 'Loading...' : 'Get Nowcast'}
            </button>
            {nowcastData && (
                <div className="mt-4 text-white">
                    <pre>{JSON.stringify(nowcastData, null, 2)}</pre>
                </div>
            )}
        </div>
    );
};

export default Nowcast;
