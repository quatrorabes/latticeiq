    }
  } catch (err) {
    console.log('No existing HubSpot connection');
  }
};



const handlePreviewImport = async () => {
  setPreviewing(true);
  setImportPreview(null);

    try {
      const headers = await getAuthHeaders();
      
      if (!isConnected && hubspotToken) {
        headers['X-HubSpot-API-Key'] = hubspotToken;
      }

      const response = await fetch(`${API_URL}/api/v3/hubspot/preview?sample_size=50`, { 
        headers 
      });

      if (response.ok) {
        const data = await response.json();
        setImportPreview({
          total_contacts: data.total_available || 0,
          valid_contacts: data.valid_count || 0,
          rejected_contacts: data.invalid_count || 0,
          rejection_reasons: data.rejection_reasons || {},
          sample_contacts: data.sample_contacts || []
        });
      } else {
        const error = await response.json();
        alert(`❌ Preview failed: ${error.detail || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`❌ Error: ${err instanceof Error ? err.message : 'Preview failed'}`);
    } finally {
      setPreviewing(false);
    }
  };

    }

    const response = await fetch(`${API_URL}/api/v3/hubspot/preview?sample_size=50`, { 
      headers 
    });

    if (response.ok) {
      const data = await response.json();
      setImportPreview({
        total_contacts: data.total_available || 0,
        valid_contacts: data.valid_count || 0,
        rejected_contacts: data.invalid_count || 0,
        rejection_reasons: data.rejection_reasons || {},
        sample_contacts: data.sample_contacts || []
      });
    } else {
      const error = await response.json();
      alert(`❌ Preview failed: ${error.detail || 'Unknown error'}`);
    }
  } catch (err) {
    alert(`❌ Error: ${err instanceof Error ? err.message : 'Preview failed'}`);
  } finally {
    setPreviewing(false);
  }
};


