import { useState, useEffect } from 'react';
import { loadRecords, formatRecordValue, RECORD_LABELS, AllTimeRecords as AllTimeRecordsType } from '../../utils/allTimeRecords';
import './AllTimeRecords.css';

interface AllTimeRecordsProps {
  onClose: () => void;
}

export function AllTimeRecords({ onClose }: AllTimeRecordsProps) {
  const [records, setRecords] = useState<AllTimeRecordsType | null>(null);

  useEffect(() => {
    setRecords(loadRecords());
  }, []);

  if (!records) return null;

  const entries = Object.entries(records).filter(([, entry]) => entry !== null);
  const hasRecords = entries.length > 0;

  return (
    <div className="records-overlay" onClick={onClose}>
      <div className="records-modal" onClick={(e) => e.stopPropagation()}>
        <div className="records-header">
          <span className="records-trophy">🏆</span>
          <h2>All-Time Records</h2>
          <p>Best performances across all World Series</p>
        </div>

        {hasRecords ? (
          <div className="records-list">
            {Object.entries(RECORD_LABELS).map(([key, { label, icon }]) => {
              const entry = records[key as keyof AllTimeRecordsType];
              return (
                <div key={key} className={`record-row ${entry ? 'has-record' : 'empty'}`}>
                  <span className="record-icon">{icon}</span>
                  <div className="record-info">
                    <div className="record-label">{label}</div>
                    {entry ? (
                      <>
                        <div className="record-player">{entry.playerName}</div>
                        <div className="record-value">{formatRecordValue(key, entry.value)}</div>
                        <div className="record-date">
                          {new Date(entry.date).toLocaleDateString()}
                        </div>
                      </>
                    ) : (
                      <div className="record-empty">No record yet</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="no-records">
            <p>No records yet!</p>
            <p>Play a World Series to set the first records.</p>
          </div>
        )}

        <button className="records-close-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
