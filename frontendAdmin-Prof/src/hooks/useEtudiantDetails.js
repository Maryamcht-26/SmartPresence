// hooks/useEtudiantProfil.js
import { useState, useEffect } from "react";
import api from "../utils/api";

export function useEtudiantDetails(etudiantId) {
  const [profil, setProfil]   = useState(null);
  const [error, setError]     = useState(null);

 
const [loading, setLoading] = useState(true);  


useEffect(() => {
    if (!etudiantId) return;
    api.get(`/etudiants/${etudiantId}/detail`)
        .then(res => setProfil(res.data))
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
}, [etudiantId]);

  return { profil, loading, error };
}