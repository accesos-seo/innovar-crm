import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function Debugger() {
  const [logs, setLogs] = useState<any[]>([]);
  
  const log = (msg: string, data?: any) => {
    setLogs(prev => [...prev, { time: new Date().toISOString(), msg, data }]);
  };

  const runTests = async () => {
    setLogs([]);
    log("Starting DB tests...");

    // 1. Check auth
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    log("Auth Session:", { user: session?.user?.email, uid: session?.user?.id, error: authError });

    if (!session?.user) {
      log("No authenticated user!");
      return;
    }

    // 2. Check profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    log("My Profile (id check):", { profile, error: profileError });

    // 3. Try listing all profiles
    const { data: allProfiles, error: allProfilesError } = await supabase.from('profiles').select('*').limit(5);
    log("All Profiles query:", { count: allProfiles?.length, error: allProfilesError });

    // 4. Try listing clients
    const { data: clients, error: clientsError } = await supabase.from('clients').select('id, name, status').limit(5);
    log("Clients query:", { count: clients?.length, error: clientsError });
    
    // 5. Try listing appointments (tasks)
    const { data: tasks, error: tasksError } = await supabase.from('tasks').select('id, title, time_slot, appointment_type, task_category').limit(5);
    log("Tasks query:", { tasks, error: tasksError });
  };

  useEffect(() => {
    runTests();
  }, []);

  return (
    <div className="p-8 pb-32 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-white">Database Debugger</h1>
      <button 
        onClick={runTests}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
      >
        Run Tests Again
      </button>
      
      <div className="space-y-2 mt-4">
        {logs.map((L, i) => (
          <div key={i} className="p-4 bg-gray-900 rounded-md text-xs font-mono text-green-400 overflow-auto">
            <div className="text-gray-400 mb-1">{L.time} - {L.msg}</div>
            {L.data && (
              <pre>{JSON.stringify(L.data, null, 2)}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
