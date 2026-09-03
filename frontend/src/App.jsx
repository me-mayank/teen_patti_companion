import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import Login from './features/auth/Login';
import Register from './features/auth/Register';
import Home from './features/games/Home';
import CreateGame from './features/games/CreateGame';
import InvitationManagement from './features/invitations/InvitationManagement';
import TurnOrderSetup from './features/turnOrder/TurnOrderSetup';
import GameBoard from './features/rounds/GameBoard';
import GameHistory from './features/games/GameHistory';
import Profile from './features/users/Profile';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Home is now imported from features/games/Home.jsx

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/games/create" 
            element={
              <ProtectedRoute>
                <CreateGame />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/games/:id/lobby" 
            element={
              <ProtectedRoute>
                <InvitationManagement />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/games/:id/turn-order" 
            element={
              <ProtectedRoute>
                <TurnOrderSetup />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/games/:id/board" 
            element={
              <ProtectedRoute>
                <GameBoard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/games/:id/history" 
            element={
              <ProtectedRoute>
                <GameHistory />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
