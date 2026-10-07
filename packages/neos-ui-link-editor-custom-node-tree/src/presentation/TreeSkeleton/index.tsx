import React from 'react';
import style from './style.module.css';

// level and label width of each placeholder row, roughly the shape of a typical document tree
const ROWS: [number, number][] = [
    [0, 30], [1, 22], [1, 38], [2, 46], [2, 34], [2, 52], [1, 26], [2, 40], [2, 44], [2, 36], [1, 30], [1, 24]
];

export const TreeSkeleton: React.FC<{label: string}> = ({label}) => (
    <div className={style.skeleton} role="status" aria-busy="true" aria-label={label}>
        {ROWS.map(([level, width], index) => (
            <div key={index} className={style.row} style={{paddingLeft: level * 24}}>
                <span className={style.chevron} />
                <span className={style.icon} />
                <span className={style.label} style={{width: `${width}%`}} />
            </div>
        ))}
    </div>
);
