import * as PIXI from 'pixi.js';
import { useEffect } from 'react';

type Callback = (dt: number) => void;

export function useTicker(callback: Callback, disabled?: boolean) {
    useEffect(() => {
        if (!disabled) {
            const tick = (dt: number) => callback(dt);
            PIXI.Ticker.shared.add(tick)
            return () => {
                PIXI.Ticker.shared.remove(tick)
            }
        }
    }, [disabled, callback]);
};