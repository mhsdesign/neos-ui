import React from 'react';
import {useDrag, useDrop} from 'react-dnd';
import cx from 'classnames';
import {Icon} from '@neos-project/react-ui-components';
import {translate} from '@neos-project/neos-ui-i18n';
import style from './style.module.css';
import {IReference} from '../../domain';

const DND_TYPE = 'neos-references-editor-item';

interface DragItem {
    type: typeof DND_TYPE;
    index: number;
}

interface ReferencesItemProps {
    reference: IReference;
    index: number;
    isSortable: boolean;
    hasPropertySchema: boolean;
    isNew?: boolean;
    onMove: (fromIndex: number, toIndex: number) => void;
    onEdit?: () => void;
    onRemove: () => void;
}

const hasPropertyValues = (properties: unknown): boolean =>
    Boolean(properties) && Object.values(properties as object).some(value => value !== null && value !== undefined && value !== '');

const ActionButton: React.FC<{
    icon: string;
    title: string;
    onClick: () => void;
    disabled?: boolean;
    isDestructive?: boolean;
}> = ({icon, title, onClick, disabled, isDestructive}) => (
    <button
        type="button"
        className={cx(style.action, {[style.actionDestructive]: isDestructive})}
        title={title}
        aria-label={title}
        disabled={disabled}
        onClick={onClick}
    >
        <Icon icon={icon} />
    </button>
);

export const ReferencesItem: React.FC<ReferencesItemProps> = (props) => {
    const {reference, index, isSortable, onMove} = props;
    const ref = React.useRef<HTMLDivElement>(null);

    // removing a reference with relation properties loses them, so it has to be confirmed
    const [isConfirmingRemoval, setIsConfirmingRemoval] = React.useState(false);

    const [, connectDrop] = useDrop({
        accept: DND_TYPE,
        hover(item: DragItem, monitor) {
            if (!ref.current || item.index === index) {
                return;
            }
            const rect = ref.current.getBoundingClientRect();
            const hoverY = (monitor.getClientOffset()?.y ?? 0) - rect.top;
            const middleY = rect.height / 2;
            if ((item.index < index && hoverY < middleY) || (item.index > index && hoverY > middleY)) {
                return;
            }
            onMove(item.index, index);
            item.index = index;
        }
    });

    const [{isDragging}, connectDrag] = useDrag({
        item: {type: DND_TYPE, index} as DragItem,
        canDrag: isSortable && !isConfirmingRemoval,
        collect: monitor => ({isDragging: monitor.isDragging()})
    });

    // the whole item can be dragged, the grip is kept as visual hint and for keyboard sorting
    connectDrag(connectDrop(ref));

    const handleGripKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            onMove(index, index - 1);
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            onMove(index, index + 1);
        }
    };

    const cancelRemovalRef = React.useRef<HTMLButtonElement>(null);
    const confirmRemovalRef = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        const confirmRemoval = confirmRemovalRef.current;
        if (!isConfirmingRemoval || !confirmRemoval) {
            return undefined;
        }
        cancelRemovalRef.current?.focus();
        // a native listener, because the dialogs listen for escape on the document and would close as well
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                setIsConfirmingRemoval(false);
            }
        };
        confirmRemoval.addEventListener('keydown', handleKeyDown);
        return () => confirmRemoval.removeEventListener('keydown', handleKeyDown);
    }, [isConfirmingRemoval]);

    const handleRemove = () => {
        if (hasPropertyValues(reference.properties)) {
            setIsConfirmingRemoval(true);
        } else {
            props.onRemove();
        }
    };

    const {presentation} = reference;
    if (!presentation) {
        return <ReferencesItemSkeleton />;
    }

    // the last breadcrumb is the referenced node itself
    const parentPath = presentation.breadcrumbs.slice(0, -1).map(({label}) => label).join(' › ');
    const showsPropertyIndicator = props.hasPropertySchema && hasPropertyValues(reference.properties);

    return (
        <div
            ref={ref}
            className={cx(style.item, {
                [style.isSortable]: isSortable,
                [style.isDragging]: isDragging
            })}
        >
            {isSortable ? (
                <span
                    className={style.grip}
                    role="button"
                    tabIndex={0}
                    aria-label={translate('Neos.Neos.Ui:Main:referencesEditor.reorder', 'Drag or use arrow keys to reorder')}
                    onKeyDown={handleGripKeyDown}
                >
                    <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor" aria-hidden="true">
                        <circle cx="2" cy="2" r="1.3" /><circle cx="6" cy="2" r="1.3" />
                        <circle cx="2" cy="7" r="1.3" /><circle cx="6" cy="7" r="1.3" />
                        <circle cx="2" cy="12" r="1.3" /><circle cx="6" cy="12" r="1.3" />
                    </svg>
                </span>
            ) : <span className={style.gripPlaceholder} />}

            <span
                className={style.icon}
                title={showsPropertyIndicator ? translate('Neos.Neos.Ui:Main:referencesEditor.hasProperties', 'Has relation properties') : undefined}
            >
                <Icon icon={presentation.icon} />
                {showsPropertyIndicator ? <span className={style.badge}><Icon icon="list" /></span> : null}
            </span>

            <span className={style.text}>
                <span className={style.label}>
                    {presentation.label}
                    {props.isNew ? <span className={style.newPill}>{translate('Neos.Neos.Ui:Main:referencesEditor.new', 'new')}</span> : null}
                </span>
                {parentPath ? <span className={style.path}>{parentPath}</span> : null}
            </span>

            <span className={style.actions}>
                {props.hasPropertySchema && props.onEdit ? (
                    <ActionButton
                        icon="sliders-h"
                        title={translate('Neos.Neos.Ui:Main:referencesEditor.editProperties', 'Edit relation properties')}
                        onClick={props.onEdit}
                    />
                ) : null}
                <ActionButton
                    icon="times"
                    title={translate('Neos.Neos.Ui:Main:referencesEditor.remove', 'Remove reference')}
                    isDestructive
                    onClick={handleRemove}
                />
            </span>

            {isConfirmingRemoval ? (
                <div
                    ref={confirmRemovalRef}
                    className={style.confirmRemoval}
                    role="alertdialog"
                    aria-label={translate('Neos.Neos.Ui:Main:referencesEditor.remove', 'Remove reference')}
                >
                    <span className={style.confirmRemovalText}>
                        {translate('Neos.Neos.Ui:Main:referencesEditor.confirmRemoval', 'Its properties will be lost.')}
                    </span>
                    <button
                        ref={cancelRemovalRef}
                        type="button"
                        className={style.confirmButton}
                        onClick={() => setIsConfirmingRemoval(false)}
                    >
                        {translate('Neos.Neos:Main:cancel', 'Cancel')}
                    </button>
                    <button
                        type="button"
                        className={cx(style.confirmButton, style.confirmButtonDestructive)}
                        onClick={props.onRemove}
                    >
                        {translate('Neos.Neos.Ui:Main:referencesEditor.removeConfirm', 'Remove')}
                    </button>
                </div>
            ) : null}
        </div>
    );
};

export const ReferencesItemSkeleton: React.FC = () => (
    <div className={cx(style.item, style.skeleton)} aria-busy="true">
        <span className={style.gripPlaceholder} />
        <span className={style.skeletonIcon} />
        <span className={style.text}>
            <span className={style.skeletonLine} />
            <span className={cx(style.skeletonLine, style.skeletonLineShort)} />
        </span>
    </div>
);
