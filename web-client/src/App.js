import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function App() {
  const [pieces, setPieces] = useState([]);
  const [mouvements, setMouvements] = useState([]);
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [utilisateurActuel, setUtilisateurActuel] = useState('');
  const [activeTab, setActiveTab] = useState('pieces');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddPiece, setShowAddPiece] = useState(false);
  const [showMouvement, setShowMouvement] = useState(false);
  const [selectedPiece, setSelectedPiece] = useState(null);
  const [alertes, setAlertes] = useState([]);

  // Formulaire nouvelle pièce
  const [newPiece, setNewPiece] = useState({
    reference: '',
    nom: '',
    categorie: '',
    quantite_stock: 0,
    quantite_min: 0,
    localisation: '',
    fournisseur: '',
    photo: ''
  });

  // Formulaire mouvement
  const [newMouvement, setNewMouvement] = useState({
    type_mouvement: 'Sortie',
    quantite: 1,
    machine_intervention: '',
    commentaire: ''
  });

  // Charger les données au démarrage
  useEffect(() => {
    fetchPieces();
    fetchMouvements();
    fetchUtilisateurs();
    fetchAlertes();
  }, []);

  const fetchPieces = async () => {
    try {
      const res = await fetch(`${API_URL}/pieces`);
      const data = await res.json();
      setPieces(data);
    } catch (err) {
      console.error('Erreur chargement pièces:', err);
    }
  };

  const fetchMouvements = async () => {
    try {
      const res = await fetch(`${API_URL}/mouvements`);
      const data = await res.json();
      setMouvements(data);
    } catch (err) {
      console.error('Erreur chargement mouvements:', err);
    }
  };

  const fetchUtilisateurs = async () => {
    try {
      const res = await fetch(`${API_URL}/utilisateurs`);
      const data = await res.json();
      setUtilisateurs(data);
    } catch (err) {
      console.error('Erreur chargement utilisateurs:', err);
    }
  };

  const fetchAlertes = async () => {
    try {
      const res = await fetch(`${API_URL}/alertes`);
      const data = await res.json();
      setAlertes(data);
    } catch (err) {
      console.error('Erreur chargement alertes:', err);
    }
  };

  const handleAddPiece = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/pieces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPiece)
      });
      if (res.ok) {
        alert('Pièce ajoutée avec succès !');
        setShowAddPiece(false);
        setNewPiece({
          reference: '',
          nom: '',
          categorie: '',
          quantite_stock: 0,
          quantite_min: 0,
          localisation: '',
          fournisseur: '',
          photo: ''
        });
        fetchPieces();
        fetchAlertes();
      } else {
        const error = await res.json();
        alert('Erreur: ' + error.error);
      }
    } catch (err) {
      alert('Erreur lors de l\'ajout');
    }
  };

  const handleMouvement = async (e) => {
    e.preventDefault();
    if (!utilisateurActuel) {
      alert('Veuillez sélectionner un utilisateur');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/mouvements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference_piece: selectedPiece.reference,
          ...newMouvement,
          utilisateur: utilisateurActuel
        })
      });
      if (res.ok) {
        alert('Mouvement enregistré !');
        setShowMouvement(false);
        setNewMouvement({
          type_mouvement: 'Sortie',
          quantite: 1,
          machine_intervention: '',
          commentaire: ''
        });
        fetchPieces();
        fetchMouvements();
        fetchAlertes();
      } else {
        const error = await res.json();
        alert('Erreur: ' + error.error);
      }
    } catch (err) {
      alert('Erreur lors du mouvement');
    }
  };

  const handleDeletePiece = async (reference) => {
    if (window.confirm('Confirmer la suppression ?')) {
      try {
        const res = await fetch(`${API_URL}/pieces/${reference}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          alert('Pièce supprimée');
          fetchPieces();
          fetchAlertes();
        }
      } catch (err) {
        alert('Erreur lors de la suppression');
      }
    }
  };

  const filteredPieces = pieces.filter(p =>
    p.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.categorie.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="App">
      <header className="header">
        <h1>🔧 GMAO - Gestion des Pièces Détachées</h1>
        <div className="user-selector">
          <label>Utilisateur: </label>
          <select 
            value={utilisateurActuel} 
            onChange={(e) => setUtilisateurActuel(e.target.value)}
          >
            <option value="">Sélectionner...</option>
            {utilisateurs.map(u => (
              <option key={u.id} value={u.nom}>{u.nom}</option>
            ))}
          </select>
        </div>
      </header>

      {alertes.length > 0 && (
        <div className="alertes-banner">
          ⚠️ {alertes.length} pièce(s) en stock minimum
        </div>
      )}

      <div className="tabs">
        <button 
          className={activeTab === 'pieces' ? 'active' : ''}
          onClick={() => setActiveTab('pieces')}
        >
          📦 Pièces
        </button>
        <button 
          className={activeTab === 'mouvements' ? 'active' : ''}
          onClick={() => setActiveTab('mouvements')}
        >
          📋 Historique
        </button>
        <button 
          className={activeTab === 'alertes' ? 'active' : ''}
          onClick={() => setActiveTab('alertes')}
        >
          ⚠️ Alertes ({alertes.length})
        </button>
      </div>

      <div className="container">
        {activeTab === 'pieces' && (
          <div>
            <div className="toolbar">
              <input
                type="text"
                placeholder="🔍 Rechercher une pièce..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <button 
                className="btn-primary"
                onClick={() => setShowAddPiece(true)}
              >
                ➕ Ajouter une pièce
              </button>
            </div>

            <div className="pieces-grid">
              {filteredPieces.map(piece => (
                <div key={piece.reference} className="piece-card">
                  <div className="piece-header">
                    <h3>{piece.nom}</h3>
                    <span className="reference">{piece.reference}</span>
                  </div>
                  <div className="piece-info">
                    <p><strong>Catégorie:</strong> {piece.categorie}</p>
                    <p><strong>Stock:</strong> 
                      <span className={piece.quantite_stock <= piece.quantite_min ? 'stock-alert' : 'stock-ok'}>
                        {piece.quantite_stock}
                      </span>
                      / Min: {piece.quantite_min}
                    </p>
                    <p><strong>Localisation:</strong> {piece.localisation}</p>
                    {piece.fournisseur && <p><strong>Fournisseur:</strong> {piece.fournisseur}</p>}
                  </div>
                  <div className="piece-actions">
                    <button 
                      className="btn-success"
                      onClick={() => {
                        setSelectedPiece(piece);
                        setNewMouvement({...newMouvement, type_mouvement: 'Entrée'});
                        setShowMouvement(true);
                      }}
                    >
                      ⬆️ Entrée
                    </button>
                    <button 
                      className="btn-warning"
                      onClick={() => {
                        setSelectedPiece(piece);
                        setNewMouvement({...newMouvement, type_mouvement: 'Sortie'});
                        setShowMouvement(true);
                      }}
                    >
                      ⬇️ Sortie
                    </button>
                    <button 
                      className="btn-danger"
                      onClick={() => handleDeletePiece(piece.reference)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'mouvements' && (
          <div className="mouvements-list">
            <h2>Historique des mouvements</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Pièce</th>
                  <th>Quantité</th>
                  <th>Utilisateur</th>
                  <th>Machine</th>
                  <th>Commentaire</th>
                </tr>
              </thead>
              <tbody>
                {mouvements.map(m => (
                  <tr key={m.id}>
                    <td>{new Date(m.date_heure).toLocaleString('fr-FR')}</td>
                    <td>
                      <span className={`badge ${m.type_mouvement === 'Entrée' ? 'badge-success' : 'badge-warning'}`}>
                        {m.type_mouvement}
                      </span>
                    </td>
                    <td>{m.nom_piece} ({m.reference_piece})</td>
                    <td>{m.quantite}</td>
                    <td>{m.utilisateur}</td>
                    <td>{m.machine_intervention || '-'}</td>
                    <td>{m.commentaire || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'alertes' && (
          <div className="alertes-list">
            <h2>⚠️ Pièces en stock minimum</h2>
            {alertes.length === 0 ? (
              <p className="no-alert">Aucune alerte stock ✅</p>
            ) : (
              <div className="pieces-grid">
                {alertes.map(piece => (
                  <div key={piece.reference} className="piece-card alert-card">
                    <div className="piece-header">
                      <h3>{piece.nom}</h3>
                      <span className="reference">{piece.reference}</span>
                    </div>
                    <div className="piece-info">
                      <p><strong>Catégorie:</strong> {piece.categorie}</p>
                      <p><strong>Stock actuel:</strong> 
                        <span className="stock-alert">{piece.quantite_stock}</span>
                      </p>
                      <p><strong>Stock minimum:</strong> {piece.quantite_min}</p>
                      <p><strong>Localisation:</strong> {piece.localisation}</p>
                    </div>
                    <button 
                      className="btn-success"
                      onClick={() => {
                        setSelectedPiece(piece);
                        setNewMouvement({...newMouvement, type_mouvement: 'Entrée'});
                        setShowMouvement(true);
                      }}
                    >
                      ⬆️ Réapprovisionner
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Ajouter Pièce */}
      {showAddPiece && (
        <div className="modal">
          <div className="modal-content">
            <h2>Ajouter une pièce</h2>
            <form onSubmit={handleAddPiece}>
              <input
                type="text"
                placeholder="Référence (ex: ROUL-001)"
                value={newPiece.reference}
                onChange={(e) => setNewPiece({...newPiece, reference: e.target.value})}
                required
              />
              <input
                type="text"
                placeholder="Nom de la pièce"
                value={newPiece.nom}
                onChange={(e) => setNewPiece({...newPiece, nom: e.target.value})}
                required
              />
              <input
                type="text"
                placeholder="Catégorie (ex: Roulements)"
                value={newPiece.categorie}
                onChange={(e) => setNewPiece({...newPiece, categorie: e.target.value})}
                required
              />
              <input
                type="number"
                placeholder="Quantité en stock"
                value={newPiece.quantite_stock}
                onChange={(e) => setNewPiece({...newPiece, quantite_stock: parseInt(e.target.value)})}
                required
              />
              <input
                type="number"
                placeholder="Quantité minimum"
                value={newPiece.quantite_min}
                onChange={(e) => setNewPiece({...newPiece, quantite_min: parseInt(e.target.value)})}
                required
              />
              <input
                type="text"
                placeholder="Localisation (ex: Armoire A - Étagère 3)"
                value={newPiece.localisation}
                onChange={(e) => setNewPiece({...newPiece, localisation: e.target.value})}
              />
              <input
                type="text"
                placeholder="Fournisseur (optionnel)"
                value={newPiece.fournisseur}
                onChange={(e) => setNewPiece({...newPiece, fournisseur: e.target.value})}
              />
              <div className="modal-actions">
                <button type="submit" className="btn-primary">Ajouter</button>
                <button type="button" className="btn-secondary" onClick={() => setShowAddPiece(false)}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Mouvement */}
      {showMouvement && selectedPiece && (
        <div className="modal">
          <div className="modal-content">
            <h2>{newMouvement.type_mouvement} - {selectedPiece.nom}</h2>
            <p>Stock actuel: {selectedPiece.quantite_stock}</p>
            <form onSubmit={handleMouvement}>
              <select
                value={newMouvement.type_mouvement}
                onChange={(e) => setNewMouvement({...newMouvement, type_mouvement: e.target.value})}
              >
                <option value="Entrée">Entrée en stock</option>
                <option value="Sortie">Sortie de stock</option>
              </select>
              <input
                type="number"
                placeholder="Quantité"
                min="1"
                value={newMouvement.quantite}
                onChange={(e) => setNewMouvement({...newMouvement, quantite: parseInt(e.target.value)})}
                required
              />
              <input
                type="text"
                placeholder="Machine / Intervention"
                value={newMouvement.machine_intervention}
                onChange={(e) => setNewMouvement({...newMouvement, machine_intervention: e.target.value})}
              />
              <textarea
                placeholder="Commentaire (optionnel)"
                value={newMouvement.commentaire}
                onChange={(e) => setNewMouvement({...newMouvement, commentaire: e.target.value})}
              />
              <div className="modal-actions">
                <button type="submit" className="btn-primary">Valider</button>
                <button type="button" className="btn-secondary" onClick={() => setShowMouvement(false)}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;