/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AsyncIterableObject } from 'vs/base/common/async';
import { CancellationToken } from 'vs/base/common/cancellation';
import { onUnexpectedExternalError } from 'vs/base/common/errors';
import { registerModelAndPositionCommand } from 'vs/editor/browser/editorExtensions';
import { Position } from 'vs/editor/common/core/position';
import { ITextModel } from 'vs/editor/common/model';
import { Hover, HoverProvider, HoverProviderRegistry } from 'vs/editor/common/modes';

export class HoverProviderResult {
	constructor(
		public readonly provider: HoverProvider,
		public readonly hover: Hover,
		public readonly ordinal: number
	) {}
}

async function executeProvider(provider: HoverProvider, ordinal: number, model: ITextModel, position: Position, token: CancellationToken): Promise<HoverProviderResult | undefined> {
	try {
		const result = await Promise.resolve(provider.provideHover(model, position, token));
		if (result && isValid(result)) {
			return new HoverProviderResult(provider, result, ordinal);
		}
	} catch (err) {
		onUnexpectedExternalError(err);
	}
	return undefined;
}

export function getHover(model: ITextModel, position: Position, token: CancellationToken): AsyncIterableObject<HoverProviderResult> {
	const providers = HoverProviderRegistry.ordered(model);
	const promises = providers.map((provider, index) => executeProvider(provider, index, model, position, token));
	return AsyncIterableObject.fromPromises(promises).coalesce();
}

export function getHoverPromise(model: ITextModel, position: Position, token: CancellationToken): Promise<Hover[]> {
	return getHover(model, position, token).map(item => item.hover).toPromise();
}

registerModelAndPositionCommand('_executeHoverProvider', (model, position) => getHoverPromise(model, position, CancellationToken.None));

function isValid(result: Hover) {
	const hasRange = (typeof result.range !== 'undefined');
	const hasHtmlContent = typeof result.contents !== 'undefined' && result.contents && result.contents.length > 0;
	return hasRange && hasHtmlContent;
}
