/*
 * This file is part of the Neos.Neos.Ui package.
 *
 * (c) Contributors of the Neos Project - www.neos.io
 *
 * This package is Open Source Software. For the full copyright and license
 * information, please view the LICENSE file which was distributed with this
 * source code.
 */
import * as React from 'react';
import {usePromise} from '@neos-project/framework-promise-react';

import {SelectBox} from '@neos-project/react-ui-components';

import {TreeDataSource} from '../domain';
import {translate} from '@neos-project/neos-ui-i18n';
import {getRegistryById} from '@neos-project/neos-ui-registry';

const searchNodeTypeFilterOptions = (
    searchTerm: string,
    options: {
        value: string;
        label: any;
        icon?: string;
    }[]
) =>
    options.filter(
        (option) =>
            option.label.toLowerCase().indexOf(searchTerm.toLowerCase()) !== -1
    );

interface Props {
    dataSource: TreeDataSource;
    value: string;
    onChange: (value: string) => void;
}

export const SelectNodeTypeFilter: React.FC<Props> = (props) => {
    const [filterTerm, setFilterTerm] = React.useState('');
    const fetch__options = usePromise(async () => {
        const options = await props.dataSource.getNodeTypeFilterOptions();

        return options.map((option) => ({
            value: option.value,
            icon: option.label.icon,
            label: getRegistryById('i18n').translate(option.label.label)
        }));
    }, [props.dataSource]);
    const options = React.useMemo(() => {
        return searchNodeTypeFilterOptions(
            filterTerm,
            fetch__options.value ?? [{value: '', label: ''}] // empty entry to prevent content shift when dropdown icon is added as items exists -> if we fix that displayLoadingIndicator doesnt shift the layout we can remove this
        );
    }, [filterTerm, fetch__options.value]);

    return (
        <SelectBox
            disabled={fetch__options.error}
            placeholder={translate('Neos.Neos:Main:filter')}
            placeholderIcon={'filter'}
            onValueChange={props.onChange}
            allowEmpty={true}
            value={props.value}
            options={options}
            displaySearchBox={true}
            searchTerm={filterTerm}
            onSearchTermChange={setFilterTerm}
            threshold={0}
            noMatchesFoundLabel={translate('Neos.Neos:Main:noMatchesFound')}
            searchBoxLeftToTypeLabel={translate('Neos.Neos:Main:searchBoxLeftToType')}
        />
    );
};
