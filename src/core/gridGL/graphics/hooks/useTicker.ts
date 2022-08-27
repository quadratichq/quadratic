import * as PIXI from 'pixi.js';
import { useEffect } from 'react';

type Callback = (dt: number) => void;

export function useTicker(ticker: PIXI.Ticker, callback: Callback, disabled?: boolean) {
    useEffect(() => {
        if (!disabled) {
            const tick = (dt: number) => callback(dt);
            ticker.add(tick)
            return () => {
                if (ticker) {
                    ticker.remove(tick)
                }
            }
        }
    }, [disabled, callback, ticker]);
};