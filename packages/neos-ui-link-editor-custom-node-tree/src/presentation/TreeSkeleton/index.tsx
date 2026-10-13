import React from 'react';
import style from './style.module.css';

// level and label width of each placeholder row, roughly the shape of a typical document tree
const ROWS: [number, number][] = [
    [0, 28], [1, 20], [1, 34], [2, 42], [2, 30], [2, 48], [1, 24], [2, 38], [2, 33], [1, 26]
];

export const TreeSkeleton: React.FC<{label: string}> = ({label}) => (
    <div className={style.skeleton} role="status" aria-busy="true" aria-label={label}>
        {ROWS.map(([level, width], index) => (
            <div key={index} className={style.row} style={{paddingLeft: `calc(var(--spacing-Half) + ${level * 24}px)`}}>
                <span className={style.chevron} />
                <span className={style.icon} />
                <span className={style.label} style={{width: `${width}%`}} />
            </div>
        ))}
    </div>
);
