import { useState, useEffect, useCallback } from "react";
import api from "../utils/api"; 

export function useFilieres() {
  const [filieres, setFilieres] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchFilieres = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/filieres");
      setFilieres(res.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Erreur lors de la récupération des filières");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFilieres();
  }, [fetchFilieres]);

  const addFiliere = async (nom) => {
    try {
      await api.post("/filieres", { nom }); 
      await fetchFilieres();
      return { success: true };
    } catch (err) {
      console.error(err);
      return {
        success: false,
        error: err.response?.data?.detail || "Erreur lors de l'ajout",
      };
    }
  };

  const updateFiliere = async (id, nom) => {
    try {
      await api.put(`/filieres/${id}`, { nom }); 
      await fetchFilieres();
      return { success: true };
    } catch (err) {
      console.error(err);
      return {
        success: false,
        error: err.response?.data?.detail || "Erreur lors de la modification",
      };
    }
  };

  const deleteFiliere = async (id) => {
    try {
      await api.delete(`/filieres/${id}`);
      await fetchFilieres();
      return { success: true };
    } catch (err) {
      console.error(err);
      return {
        success: false,
        error: err.response?.data?.detail || "Erreur lors de la suppression",
      };
    }
  };

  return {
    filieres,
    loading,
    error,
    fetchFilieres,
    addFiliere,
    updateFiliere,
    deleteFiliere,
  };
}