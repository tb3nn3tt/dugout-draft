import React, { useState, useEffect } from 'react';
import { Player } from '../../types';
import { isHitter } from '../../utils/helpers';
import { generateOptimalLineup } from '../../utils/lineupBuilder';
import { Button } from '../shared/Button';
import './BattingOrder.css';

interface BattingOrderProps {
  roster: Player[];
  battingOrder: Player[];
  onChange: (order: Player[]) => void;
  teamName: string;
}

export function BattingOrder({ roster, battingOrder, onChange, teamName }: BattingOrderProps) {
  const [order, setOrder] = useState<Player[]>(battingOrder);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const hitters = roster.filter(isHitter);
  const availableHitters = hitters.filter(h => !order.some(o => o.id === h.id));

  useEffect(() => {
    // Auto-populate if empty
    if (order.length === 0 && hitters.length >= 9) {
      setOrder(generateOptimalLineup(roster).map(e => e.player));
    }
  }, [hitters]);

  useEffect(() => {
    onChange(order);
  }, [order, onChange]);

  const addToOrder = (player: Player) => {
    if (order.length < 9) {
      setOrder([...order, player]);
    }
  };

  const removeFromOrder = (index: number) => {
    const newOrder = [...order];
    newOrder.splice(index, 1);
    setOrder(newOrder);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newOrder = [...order];
    const draggedItem = newOrder[draggedIndex];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(index, 0, draggedItem);
    setOrder(newOrder);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...order];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setOrder(newOrder);
  };

  const moveDown = (index: number) => {
    if (index === order.length - 1) return;
    const newOrder = [...order];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setOrder(newOrder);
  };

  const autoFill = () => {
    setOrder(generateOptimalLineup(roster).map(e => e.player));
  };

  return (
    <div className="batting-order">
      <div className="batting-order-header">
        <h3>{teamName} Batting Order</h3>
        <Button variant="outline" size="sm" onClick={autoFill}>
          Auto-Fill
        </Button>
      </div>

      <div className="lineup-container">
        <div className="lineup-slots">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((slot, index) => (
            <div
              key={slot}
              className={`lineup-slot ${order[index] ? 'filled' : 'empty'} ${draggedIndex === index ? 'dragging' : ''}`}
              onDragOver={(e) => handleDragOver(e, index)}
            >
              <span className="slot-number">{slot}</span>
              {order[index] ? (
                <div
                  className="slot-player"
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="player-info">
                    <span className="player-pos">{order[index].positions[0]}</span>
                    <span className="player-name">{order[index].name}</span>
                    <span className="player-avg">{(order[index].stats.avg ?? 0).toFixed(3)}</span>
                  </div>
                  <div className="slot-actions">
                    <button className="action-btn" onClick={() => moveUp(index)} disabled={index === 0}>
                      ↑
                    </button>
                    <button className="action-btn" onClick={() => moveDown(index)} disabled={index === order.length - 1}>
                      ↓
                    </button>
                    <button className="action-btn remove" onClick={() => removeFromOrder(index)}>
                      ×
                    </button>
                  </div>
                </div>
              ) : (
                <div className="slot-empty">Drop player here</div>
              )}
            </div>
          ))}
        </div>

        <div className="available-players">
          <h4>Available Hitters ({availableHitters.length})</h4>
          <div className="available-list">
            {availableHitters.map(player => (
              <div
                key={player.id}
                className="available-player"
                onClick={() => addToOrder(player)}
              >
                <span className="player-pos">{player.positions[0]}</span>
                <span className="player-name">{player.name}</span>
                <span className="player-overall">{player.overall}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {order.length < 9 && (
        <div className="lineup-warning">
          Select {9 - order.length} more player(s) to complete lineup
        </div>
      )}
    </div>
  );
}
