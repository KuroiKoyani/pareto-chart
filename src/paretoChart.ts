
import {
    BaseType,
    select as d3Select,
    Selection as d3Selection
} from "d3-selection";
import {
    scaleBand,
    scaleLinear,
    ScaleLinear
} from "d3-scale";

import * as d3 from "d3";

import { axisBottom, axisLeft, axisRight } from "d3-axis";

import powerbiVisualsApi from "powerbi-visuals-api";
import { createTooltipServiceWrapper, ITooltipServiceWrapper } from "powerbi-visuals-utils-tooltiputils";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { textMeasurementService, valueFormatter } from "powerbi-visuals-utils-formattingutils";
import {
    HtmlSubSelectableClass, HtmlSubSelectionHelper, SubSelectableDirectEdit as SubSelectableDirectEditAttr,
    SubSelectableDisplayNameAttribute, SubSelectableObjectNameAttribute, SubSelectableTypeAttribute
} from 'powerbi-visuals-utils-onobjectutils';

import { BarChartSettingsModel } from "./barChartSettingsModel";
import { getLocalizedString } from "./localization/localizationHelper"
import { getValue, getCategoricalObjectValue } from "./objectEnumerationUtility";

import "./../style/visual.less";

import powerbi = powerbiVisualsApi;

type Selection<T1, T2 = T1> = d3Selection<any, T1, any, T2>;

// powerbi.visuals
import CustomVisualSubSelection = powerbi.visuals.CustomVisualSubSelection;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import DataViewObjects = powerbi.DataViewObjects;
import Fill = powerbi.Fill;
import ISandboxExtendedColorPalette = powerbi.extensibility.ISandboxExtendedColorPalette;
import ISelectionId = powerbi.visuals.ISelectionId;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import IVisual = powerbi.extensibility.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import PrimitiveValue = powerbi.PrimitiveValue;
import SubSelectableDirectEdit = powerbi.visuals.SubSelectableDirectEdit;
import SubSelectableDirectEditStyle = powerbi.visuals.SubSelectableDirectEditStyle;
import SubSelectionStyles = powerbi.visuals.SubSelectionStyles;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualShortcutType = powerbi.visuals.VisualShortcutType;
import VisualSubSelectionShortcuts = powerbi.visuals.VisualSubSelectionShortcuts;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import SubSelectionStylesType = powerbi.visuals.SubSelectionStylesType;
import FormattingId = powerbi.visuals.FormattingId;


/**
 * Interface for BarChart data points.
 *
 * @interface
 * @property {PrimitiveValue} value             - Data value for point.
 * @property {string} category          - Corresponding category of data value.
 * @property {string} color             - Color corresponding to data point.
 * @property {string} strokeColor       - Stroke color for data point column.
 * @property {number} strokeWidth       - Stroke width for data point column.
 * @property {ISelectionId} selectionId - Id assigned to data point for cross filtering
 *                                        and visual interaction.
 */
export interface BarChartDataPoint {
    cumulative?: number;
    value: PrimitiveValue;
    category: string;
    color: string;
    strokeColor: string;
    strokeWidth: number;
    selectionId: ISelectionId;
    index: number;
    format?: string;
}

interface References {
    cardUid?: string;
    groupUid?: string;
    fill?: FormattingId;
    font?: FormattingId;
    fontColor?: FormattingId;
    show?: FormattingId;
    fontFamily?: FormattingId;
    bold?: FormattingId;
    italic?: FormattingId;
    underline?: FormattingId;
    fontSize?: FormattingId;
    position?: FormattingId;
    textProperty?: FormattingId;
}

const enum BarChartObjectNames {
    ArcElement = 'arcElement',
    ColorSelector = 'colorSelector',
    EnableAxis = 'enableAxis',
    DirectEdit = 'directEdit'
}

const DirectEdit: SubSelectableDirectEdit = {
    reference: {
        objectName: 'directEdit',
        propertyName: 'textProperty'
    },
    style: SubSelectableDirectEditStyle.Outline,
};

const colorSelectorReferences: References = {
    cardUid: 'Visual-colorSelector-card',
    groupUid: 'colorSelector-group',
    fill: {
        objectName: BarChartObjectNames.ColorSelector,
        propertyName: 'fill'
    }
};

const enableAxisReferences: References = {
    cardUid: 'Visual-enableAxis-card',
    groupUid: 'enableAxis-group',
    fill: {
        objectName: BarChartObjectNames.EnableAxis,
        propertyName: 'fill'
    },
    show: {
        objectName: BarChartObjectNames.EnableAxis,
        propertyName: 'show'
    }
};

const directEditReferences: References = {
    cardUid: 'Visual-directEdit-card',
    groupUid: 'directEdit-group',
    fontFamily: {
        objectName: BarChartObjectNames.DirectEdit,
        propertyName: 'fontFamily'
    },
    bold: {
        objectName: BarChartObjectNames.DirectEdit,
        propertyName: 'bold'
    },
    italic: {
        objectName: BarChartObjectNames.DirectEdit,
        propertyName: 'italic'
    },
    underline: {
        objectName: BarChartObjectNames.DirectEdit,
        propertyName: 'underline'
    },
    fontSize: {
        objectName: BarChartObjectNames.DirectEdit,
        propertyName: 'fontSize'
    },
    fontColor: {
        objectName: BarChartObjectNames.DirectEdit,
        propertyName: 'fontColor'
    },
    show: {
        objectName: BarChartObjectNames.DirectEdit,
        propertyName: 'show'
    },
    position: {
        objectName: BarChartObjectNames.DirectEdit,
        propertyName: 'position'
    },
    textProperty: {
        objectName: BarChartObjectNames.DirectEdit,
        propertyName: 'textProperty'
    }
};

/**
 * Function that converts queried data into a view model that will be used by the visual.
 *
 * @function
 * @param {VisualUpdateOptions} options - Contains references to the size of the container
 *                                        and the dataView which contains all the data
 *                                        the visual had queried.
 * @param {IVisualHost} host            - Contains references to the host which contains services
 */
function createSelectorDataPoints(options: VisualUpdateOptions, host: IVisualHost): BarChartDataPoint[] {
    const barChartDataPoints: BarChartDataPoint[] = []
    const dataViews = options.dataViews;

    if (!dataViews
        || !dataViews[0]
        || !dataViews[0].categorical
        || !dataViews[0].categorical.categories
        || !dataViews[0].categorical.categories[0].source
        || !dataViews[0].categorical.values
    ) {
        return barChartDataPoints;
    }

    const categorical = dataViews[0].categorical;
    const category = categorical.categories[0];
    const dataValue = categorical.values[0];

    //let dataMax: number = 0;

    const colorPalette: ISandboxExtendedColorPalette = host.colorPalette;
    //const objects = dataViews[0].metadata.objects;

    const strokeColor: string = getColumnStrokeColor(colorPalette);

    const strokeWidth: number = getColumnStrokeWidth(colorPalette.isHighContrast);

    for (let i = 0, len = Math.max(category.values.length, dataValue.values.length); i < len; i++) {
        const color: string = getColumnColorByIndex(category, i, colorPalette);

        const selectionId: ISelectionId = host.createSelectionIdBuilder()
            .withCategory(category, i)
            .createSelectionId();

        barChartDataPoints.push({
            color,
            strokeColor,
            strokeWidth,
            selectionId,
            value: dataValue.values[i],
            category: `${category.values[i]}`,
            index: i,
            format: dataValue.objects ? <string>dataValue.objects[i].general.formatString : null,
        });
    }

    return barChartDataPoints;
}

function getColumnColorByIndex(
    category: DataViewCategoryColumn,
    index: number,
    colorPalette: ISandboxExtendedColorPalette,
): string {
    if (colorPalette.isHighContrast) {
        return colorPalette.background.value;
    }

    const defaultColor: Fill = {
        solid: {
            color: colorPalette.getColor(`${category.values[index]}`).value,
        }
    };

    return getCategoricalObjectValue<Fill>(
        category,
        index,
        'colorSelector',
        'fill',
        defaultColor
    ).solid.color;
}

function getColumnStrokeColor(colorPalette: ISandboxExtendedColorPalette): string {
    return colorPalette.isHighContrast
        ? colorPalette.foreground.value
        : null;
}

function getColumnStrokeWidth(isHighContrast: boolean): number {
    return isHighContrast
        ? 2
        : 0;
}

function getAxisTextFillColor(
    objects: DataViewObjects,
    colorPalette: ISandboxExtendedColorPalette,
    defaultColor: string
): string {
    if (colorPalette.isHighContrast) {
        return colorPalette.foreground.value;
    }

    return getValue<Fill>(
        objects,
        "enableAxis",
        "fill",
        {
            solid: {
                color: defaultColor,
            }
        },
    ).solid.color;
}

export class ParetoChart implements IVisual {
    private averageLine: Selection<SVGElement>;
    private barContainer: Selection<SVGElement>;
    private barDataPoints: BarChartDataPoint[];
    private element: HTMLElement;
    private formattingSettingsService: FormattingSettingsService;
    private formattingSettings: BarChartSettingsModel;
    private host: IVisualHost;
    private isLandingPageOn: boolean;
    private LandingPage: Selection<any>;
    private LandingPageRemoved: boolean;
    private locale: string;
    private selectionManager: ISelectionManager;
    private svg: Selection<any>;
    private tooltipServiceWrapper: ITooltipServiceWrapper;
    private xAxis: Selection<SVGElement>;
    private line: Selection<SVGElement>;
    private circle: Selection<SVGElement>;
    private tooltip: Selection<SVGElement>;

    private yAxisLeft: Selection<SVGElement>;
    private yAxisRight: Selection<SVGElement>;

    private barSelection: Selection<any>;

    private subSelectionHelper: HtmlSubSelectionHelper;
    private formatMode: boolean = false;
    private directEditElement: Selection<SVGElement>;
    private visualDirectEditSubSelection = JSON.stringify(DirectEdit);
    public visualOnObjectFormatting?: powerbi.extensibility.visual.VisualOnObjectFormatting;

    static Config = {
        xScalePadding: 0.1,
        solidOpacity: 1,
        transparentOpacity: 0.4,
        margins: {
            top: 20,
            right: 2,
            bottom: 5,
            left: 30,
        },
        xAxisFontMultiplier: 0.04,
    };

    /**
     * Creates instance of BarChart. This method is only called once.
     *
     * @constructor
     * @param {VisualConstructorOptions} options - Contains references to the element that will
     *                                             contain the visual and a reference to the host
     *                                             which contains services.
     */
    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.element = options.element;
        this.selectionManager = options.host.createSelectionManager();
        this.locale = options.host.locale;

        this.selectionManager.registerOnSelectCallback(() => {
            this.syncSelectionState(this.barSelection, <ISelectionId[]>this.selectionManager.getSelectionIds());
        });

        this.tooltipServiceWrapper = createTooltipServiceWrapper(this.host.tooltipService, options.element);

        //Creating the formatting settings service.
        const localizationManager = this.host.createLocalizationManager();
        this.formattingSettingsService = new FormattingSettingsService(localizationManager);

        this.subSelectionHelper = HtmlSubSelectionHelper.createHtmlSubselectionHelper({
            hostElement: options.element,
            subSelectionService: options.host.subSelectionService,
            selectionIdCallback: (e) => this.selectionIdCallback(e),
        });

        this.svg = d3Select(options.element)
            .append('svg')
            .classed('barChart', true).attr('height', options.element.clientHeight - 10);

        this.barContainer = this.svg
            .append('g')
            .classed('barContainer', true);

        this.xAxis = this.svg
            .append('g')
            .classed('xAxis', true);

        this.line = this.svg
            .append('path')
            .classed('line', true)
        
        this.circle = this.svg
        .append('g')
        .classed('circle', true);

        this.tooltip = this.svg
        .append('g')
        .classed('tooltip', true);


        this.yAxisLeft = this.barContainer
            .append('g')
            .classed('yAxisLeft', true);

        this.yAxisRight = this.svg
            .append('g')
            .classed('yAxisRight', true);

        this.initAverageLine();

        const directEditDiv = this.creatDirectEditElement();
        // options.element.appendChild(directEditDiv);
        this.directEditElement = d3Select(directEditDiv);

        this.visualOnObjectFormatting = {
            getSubSelectionStyles: (subSelections) => this.getSubSelectionStyles(subSelections),
            getSubSelectionShortcuts: (subSelections) => this.getSubSelectionShortcuts(subSelections),
            getSubSelectables: (filter) => this.getSubSelectables(filter)
        };

        this.handleContextMenu();
    }

    /**
     * Updates the state of the visual. Every sequential databinding and resize will call update.
     *
     * @function
     * @param {VisualUpdateOptions} options - Contains references to the size of the container
     *                                        and the dataView which contains all the data
     *                                        the visual had queried.
     */
    public update(options: VisualUpdateOptions) {
        // Turn on landing page in capabilities and remove comment to turn on landing page!
        // this.HandleLandingPage(options);
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(BarChartSettingsModel, options.dataViews?.[0]);
        this.barDataPoints = createSelectorDataPoints(options, this.host);
        this.formattingSettings.populateColorSelector(this.barDataPoints);
        this.formatMode = options.formatMode;
        let width = options.viewport.width;
        let height = options.viewport.height;
        let total = 0;

        this.barDataPoints.forEach((value: BarChartDataPoint) => {
            total += <number>value.value;
        });


        this.svg
            .attr("width", width)
            .attr("height", height);

        if (this.formattingSettings.enableAxis.show.value) {
            const margins = ParetoChart.Config.margins;
        }
        
        const margins = ParetoChart.Config.margins;
        height -= margins.bottom;

        this.updateDirectEditElementFormat();
        this.xAxis
            .style("font-size", Math.min(height, width) * ParetoChart.Config.xAxisFontMultiplier)
            .style("fill", this.formattingSettings.enableAxis.fill.value.value);

        this.yAxisLeft
            .style("font-size", Math.min(height, width) * ParetoChart.Config.xAxisFontMultiplier)
            // .style("fill", this.formattingSettings.enableAxis.fill.value.value);

        this.yAxisRight
            .style("font-size", Math.min(height, width) * ParetoChart.Config.xAxisFontMultiplier)
            // .style("fill", this.formattingSettings.enableAxis.fill.value.value);
        console.log( Math.min(height, width) * ParetoChart.Config.xAxisFontMultiplier/ 5)
        const yScale = scaleLinear()
            .domain([0, total])
            .range([height, margins.top]);

        const yScaleRight = scaleLinear()
            .domain([0, 100])
            .range([height, margins.top])

        const xScale = scaleBand()
            .domain(this.barDataPoints.map(d => d.category))
            .rangeRound([0, width])
            .padding(0.2);



        const xAxis = axisBottom(xScale);
        const yAxisLeft = axisRight(yScale);
        const yAxisRight = axisLeft(yScaleRight);


        const colorObjects = options.dataViews[0] ? options.dataViews[0].metadata.objects : null;
        this.xAxis.attr('transform', 'translate(0, ' + height + ')')
            .call(xAxis)
            .attr("color", getAxisTextFillColor(
                colorObjects,
                this.host.colorPalette,
                this.formattingSettings.enableAxis.fill.value.value
            ));

        this.yAxisLeft.attr('transform', 'translate(' + 0 + ', 0)')
            .call(yAxisLeft)
            .attr("color", getAxisTextFillColor(
                colorObjects,
                this.host.colorPalette,
                this.formattingSettings.enableAxis.fill.value.value
            ));

        this.yAxisRight.attr('transform', 'translate(' +  (width - margins.right )+ ', 0)')
            .call(yAxisRight)
            .attr("color", getAxisTextFillColor(
                colorObjects,
                this.host.colorPalette,
                this.formattingSettings.enableAxis.fill.value.value
            ));

            let cumulative = 0;

        const lineDataPoints: [number, number][]  = this.barDataPoints.map((el, i) => {
            cumulative = cumulative + <number>el.value / total * 100;
            el.cumulative = cumulative;
            return [
                xScale(el.category) + xScale.bandwidth(),
                yScaleRight(cumulative)
            ]
        });

        const startPoint: [number, number] = [xScale( this.barDataPoints[0].category), yScaleRight(0)];

        const lineArray: [number, number][] = [ [...startPoint],...lineDataPoints];

        const guide = d3.line()

        console.log(lineDataPoints)

        this.line
        .attr("d", guide(lineArray) )
        .style('fill', 'none')
        .style('stroke', 'black');

        this.circle.selectAll('.myCircle').remove();


        lineDataPoints.forEach((el) => {
            this.circle
            .append("circle")
              .attr("class", "myCircle")
              .attr("cx", el[0] )
              .attr("cy", el[1])
              .attr("r", Math.min(height, width) / 50)
              .attr("stroke", "black")
            .attr("stroke-width", 3)
            .attr("fill", "white");
        })

        this.barSelection = this.barContainer
            .selectAll('.bar')
            .data(this.barDataPoints);

        console.log(this.barDataPoints)

        const barSelectionMerged = this.barSelection
            .enter()
            .append('rect')
            .merge(<any>this.barSelection);

        barSelectionMerged.classed('bar', true);

        const opacity: number = this.formattingSettings.generalView.opacity.value / 100;
        barSelectionMerged
            .attr(SubSelectableObjectNameAttribute, 'colorSelector')
            .attr(SubSelectableDisplayNameAttribute, (dataPoint: BarChartDataPoint) => this.formattingSettings.colorSelector.slices[dataPoint.index].displayName)
            .attr(SubSelectableTypeAttribute, powerbi.visuals.SubSelectionStylesType.Shape)
            .classed(HtmlSubSelectableClass, options.formatMode)
            .attr("width", xScale.bandwidth())
            .attr("height", d => height - yScale(<number>d.value))
            .attr("y", d => yScale(<number>d.value))
            .attr("x", d => xScale(d.category))
            .style("fill-opacity", opacity)
            .style("stroke-opacity", opacity)
            .style("fill", (dataPoint: BarChartDataPoint) => dataPoint.color)
            .style("stroke", (dataPoint: BarChartDataPoint) => dataPoint.strokeColor)
            .style("stroke-width", (dataPoint: BarChartDataPoint) => `${dataPoint.strokeWidth}px`);

        this.tooltipServiceWrapper.addTooltip(barSelectionMerged,
            (dataPoint: BarChartDataPoint) => this.getTooltipData(dataPoint),
            (dataPoint: BarChartDataPoint) => dataPoint.selectionId
        );

        this.syncSelectionState(
            barSelectionMerged,
            <ISelectionId[]>this.selectionManager.getSelectionIds()
        );
        if (this.formatMode) {
            this.removeEventHandlers(barSelectionMerged);
        } else {
            this.addEventHandlers(barSelectionMerged);
        }

        this.subSelectionHelper.setFormatMode(options.formatMode);
        const shouldUpdateSubSelection = options.type & (powerbi.VisualUpdateType.Data
            | powerbi.VisualUpdateType.Resize
            | powerbi.VisualUpdateType.FormattingSubSelectionChange);
        if (this.formatMode && shouldUpdateSubSelection) {
            this.subSelectionHelper.updateOutlinesFromSubSelections(options.subSelections, true);
        }

        this.barSelection
            .exit()
            .remove();
        this.handleClick(barSelectionMerged);
    }

    private removeEventHandlers(barSelectionMerged: d3Selection<SVGRectElement, any, any, any>) {
        barSelectionMerged.on('click', null);
        this.svg.on('click', null);
        this.svg.on('contextmenu', null);
    }

    private addEventHandlers(barSelectionMerged: d3Selection<SVGRectElement, any, any, any>) {
        this.handleBarClick(barSelectionMerged);
        this.handleClick(barSelectionMerged);
        this.handleContextMenu();
    }

    private updateDirectEditElementFormat() {
        this.directEditElement
            .classed('direct-edit', true)
            .classed('hidden', !this.formattingSettings.directEditSettings.show.value)
            .classed(HtmlSubSelectableClass, this.formatMode && this.formattingSettings.directEditSettings.show.value)
            .attr(SubSelectableObjectNameAttribute, 'directEdit')
            .attr(SubSelectableDisplayNameAttribute, 'Direct Edit')
            .attr(SubSelectableDirectEditAttr, this.visualDirectEditSubSelection)
            .style('font-family', this.formattingSettings.directEditSettings.font.fontFamily.value)
            .style('color', this.formattingSettings.directEditSettings.fontColor.value.value)
            .style('font-style', this.formattingSettings.directEditSettings.font.italic.value ? 'italic' : 'normal')
            .style('text-decoration', this.formattingSettings.directEditSettings.font.underline.value ? 'underline' : 'none')
            .style('font-weight', this.formattingSettings.directEditSettings.font.bold.value ? 'bold' : 'normal')
            .style('right', this.formattingSettings.directEditSettings.position.value.value === 'Right' ? '12px' : '60px')
            .style('background-color', this.formattingSettings.directEditSettings.background.value.value)
            .style('font-size', `${this.formattingSettings.directEditSettings.font.fontSize.value}px`)
    }
    private static wordBreak(
        textNodes: Selection<any, SVGElement>,
        allowedWidth: number,
        maxHeight: number
    ) {
        textNodes.each(function () {
            textMeasurementService.wordBreak(
                this,
                allowedWidth,
                maxHeight);
        });
    }

    private handleBarClick(barSelectionMerged: Selection<any>) {
        barSelectionMerged.on('click', (event: Event, datum: BarChartDataPoint) => {
            // Allow selection only if the visual is rendered in a view that supports interactivity (e.g. Report)
            if (this.host.hostCapabilities.allowInteractions) {
                const isCtrlPressed: boolean = (<MouseEvent>event).ctrlKey;

                this.selectionManager
                    .select(datum.selectionId, isCtrlPressed)
                    .then((ids: ISelectionId[]) => {
                        this.syncSelectionState(barSelectionMerged, ids);
                    });
                event.stopPropagation();
            }
        });
    }

    private handleClick(barSelection: Selection<any>) {
        // Clear selection when clicking outside a bar
        this.svg.on('click', () => {
            if (this.host.hostCapabilities.allowInteractions) {
                this.selectionManager
                    .clear()
                    .then(() => {
                        this.syncSelectionState(barSelection, []);
                    });
            }
        });
    }


    private handleContextMenu() {
        this.svg.on('contextmenu', (event) => {
            const mouseEvent: MouseEvent = event;
            const eventTarget: EventTarget = mouseEvent.target;
            const dataPoint: any = d3Select(<BaseType>eventTarget).datum();
            this.selectionManager.showContextMenu(dataPoint ? dataPoint.selectionId : {}, {
                x: mouseEvent.clientX,
                y: mouseEvent.clientY
            });
            mouseEvent.preventDefault();
        });
    }

    private syncSelectionState(
        selection: Selection<BarChartDataPoint>,
        selectionIds: ISelectionId[]
    ): void {
        if (!selection || !selectionIds) {
            return;
        }

        if (!selectionIds.length) {
            const opacity: number = this.formattingSettings.generalView.opacity.value / 100;
            selection
                .style("fill-opacity", opacity)
                .style("stroke-opacity", opacity);
            return;
        }
        // eslint-disable-next-line
        const self: this = this;

        selection.each(function (barDataPoint: BarChartDataPoint) {
            const isSelected: boolean = self.isSelectionIdInArray(selectionIds, barDataPoint.selectionId);

            const opacity: number = isSelected
                ? ParetoChart.Config.solidOpacity
                : ParetoChart.Config.transparentOpacity;

            d3Select(this)
                .style("fill-opacity", opacity)
                .style("stroke-opacity", opacity);
        });
    }

    private isSelectionIdInArray(selectionIds: ISelectionId[], selectionId: ISelectionId): boolean {
        if (!selectionIds || !selectionId) {
            return false;
        }

        return selectionIds.some((currentSelectionId: ISelectionId) => {
            return currentSelectionId.includes(selectionId);
        });
    }

    /**
     * Returns properties pane formatting model content hierarchies, properties and latest formatting values, Then populate properties pane.
     * This method is called once every time we open properties pane or when the user edit any format property. 
     */
    public getFormattingModel(): powerbiVisualsApi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }

    private getSubSelectionStyles(subSelections: CustomVisualSubSelection[]): powerbi.visuals.SubSelectionStyles | undefined {
        const visualObject = subSelections[0]?.customVisualObjects[0];
        if (visualObject) {
            switch (visualObject.objectName) {
                case BarChartObjectNames.ColorSelector:
                    return this.getColorSelectorStyles(subSelections);
                case BarChartObjectNames.EnableAxis:
                    return this.getEnableAxisStyles();
                case BarChartObjectNames.DirectEdit:
                    return this.getDirectEditStyles();
            }
        }
    }
    private getSubSelectionShortcuts(subSelections: CustomVisualSubSelection[]): VisualSubSelectionShortcuts | undefined {
        const visualObject = subSelections[0]?.customVisualObjects[0];
        if (visualObject) {
            switch (visualObject.objectName) {
                case BarChartObjectNames.ColorSelector:
                    return this.getColorSelectorShortcuts(subSelections);
                case BarChartObjectNames.EnableAxis:
                    return this.getEnableAxisShortcuts();
                case BarChartObjectNames.DirectEdit:
                    return this.getDirectEditShortcuts();
            }
        }
    }
    private getSubSelectables?(filter?: powerbi.visuals.SubSelectionStylesType): CustomVisualSubSelection[] | undefined {
        return this.subSelectionHelper.getAllSubSelectables(filter);
    }

    private getColorSelectorShortcuts(subSelections: CustomVisualSubSelection[]): VisualSubSelectionShortcuts {
        const selector = subSelections[0].customVisualObjects[0].selectionId?.getSelector();
        return [
            {
                type: VisualShortcutType.Reset,
                relatedResetFormattingIds: [{
                    ...colorSelectorReferences.fill,
                    selector
                }],
            },
            {
                type: VisualShortcutType.Navigate,
                destinationInfo: { cardUid: colorSelectorReferences.cardUid },
                label: 'Color'
            }
        ];
    }

    private getColorSelectorStyles(subSelections: CustomVisualSubSelection[]): SubSelectionStyles {
        const selector = subSelections[0].customVisualObjects[0].selectionId?.getSelector();
        return {
            type: SubSelectionStylesType.Shape,
            fill: {
                label: 'Fill',
                reference: {
                    ...colorSelectorReferences.fill,
                    selector
                },
            },
        };
    }

    private getEnableAxisStyles(): SubSelectionStyles {
        return {
            type: SubSelectionStylesType.Shape,
            fill: {
                reference: {
                    ...enableAxisReferences.fill
                },
                label: 'Enable Axis'
            }
        }
    }

    private getEnableAxisShortcuts(): VisualSubSelectionShortcuts {
        return [
            {
                type: VisualShortcutType.Reset,
                relatedResetFormattingIds: [{
                    ...enableAxisReferences.fill,
                }],
                excludedResetFormattingIds: [{
                    ...enableAxisReferences.show,
                }]
            },
            {
                type: VisualShortcutType.Toggle,
                relatedToggledFormattingIds: [{
                    ...enableAxisReferences.show
                }],
                ...enableAxisReferences.show,
                disabledLabel: 'Delete',
                enabledLabel: 'Delete'
            },
            {
                type: VisualShortcutType.Navigate,
                destinationInfo: { cardUid: enableAxisReferences.cardUid },
                label: 'EnableAxis'
            }
        ];
    }

    private getDirectEditShortcuts(): VisualSubSelectionShortcuts {
        return [
            {
                type: VisualShortcutType.Reset,
                relatedResetFormattingIds: [
                    directEditReferences.bold,
                    directEditReferences.fontFamily,
                    directEditReferences.fontSize,
                    directEditReferences.italic,
                    directEditReferences.underline,
                    directEditReferences.fontColor,
                    directEditReferences.textProperty
                ]
            },
            {
                type: VisualShortcutType.Toggle,
                relatedToggledFormattingIds: [{
                    ...directEditReferences.show,
                }],
                ...directEditReferences.show,
                disabledLabel: 'Delete',

            },
            {
                type: VisualShortcutType.Picker,
                ...directEditReferences.position,
                label: 'Position'
            },
            {
                type: VisualShortcutType.Navigate,
                destinationInfo: { cardUid: directEditReferences.cardUid },
                label: 'Direct edit'
            }
        ];
    }

    private getDirectEditStyles(): SubSelectionStyles {
        return {
            type: powerbi.visuals.SubSelectionStylesType.Text,
            fontFamily: {
                reference: {
                    ...directEditReferences.fontFamily
                },
                label: 'font'
            },
            bold: {
                reference: {
                    ...directEditReferences.bold
                },
                label: 'font'
            },
            italic: {
                reference: {
                    ...directEditReferences.italic
                },
                label: 'font'
            },
            underline: {
                reference: {
                    ...directEditReferences.underline
                },
                label: 'font'
            },
            fontSize: {
                reference: {
                    ...directEditReferences.fontSize
                },
                label: 'font'
            },
            fontColor: {
                reference: {
                    ...directEditReferences.fontColor
                },
                label: 'fontColor'
            },
            background: {
                reference: {
                    objectName: 'directEdit',
                    propertyName: 'background'
                },
                label: 'background'
            }
        };
    }

    public selectionIdCallback(e: Element): ISelectionId {
        const elementType: string = d3Select(e).attr(SubSelectableObjectNameAttribute);
        let selectionId: ISelectionId = undefined;

        switch (elementType) {
            case BarChartObjectNames.ColorSelector:
                selectionId = d3Select<Element, BarChartDataPoint>(e).datum().selectionId;
                break;
        }

        return selectionId;
    }

    private creatDirectEditElement(): Element {
        const element = document.createElement('div');
        element.setAttribute('class', 'direct-edit');
        return element;
    }

    /**
     * Destroy runs when the visual is removed. Any cleanup that the visual needs to
     * do should be done here.
     *
     * @function
     */
    public destroy(): void {
        // Perform any cleanup tasks here
    }

    private getTooltipData(value: any): VisualTooltipDataItem[] {
        const formattedValue = valueFormatter.format(value.value, value.format);
        return [{
            displayName: value.category,
            value: formattedValue,
            color: value.color,
            header: "Cumulative %: " + value.  cumulative.toFixed(2)
        }];
    }

    private createHelpLinkElement(): Element {
        const linkElement = document.createElement("a");
        linkElement.textContent = "?";
        linkElement.setAttribute("title", "Open documentation");
        linkElement.setAttribute("class", "helpLink");
        linkElement.addEventListener("click", () => {
            this.host.launchUrl("https://microsoft.github.io/PowerBI-visuals/tutorials/building-bar-chart/adding-url-launcher-element-to-the-bar-chart/");
        });
        return linkElement;
    }

    private handleLandingPage(options: VisualUpdateOptions) {
        if (!options.dataViews || !options.dataViews.length) {
            if (!this.isLandingPageOn) {
                this.isLandingPageOn = true;
                const SampleLandingPage: Element = this.createSampleLandingPage();
                this.element.appendChild(SampleLandingPage);

                this.LandingPage = d3Select(SampleLandingPage);
            }

        } else {
            if (this.isLandingPageOn && !this.LandingPageRemoved) {
                this.LandingPageRemoved = true;
                this.LandingPage.remove();
            }
        }
    }

    private createSampleLandingPage(): Element {
        const div = document.createElement("div");

        const header = document.createElement("h1");
        header.textContent = "Sample Bar Chart Landing Page";
        header.setAttribute("class", "LandingPage");
        const p1 = document.createElement("a");
        p1.setAttribute("class", "LandingPageHelpLink");
        p1.textContent = "Learn more about Landing page";

        p1.addEventListener("click", () => {
            this.host.launchUrl("https://microsoft.github.io/PowerBI-visuals/docs/overview/");
        });

        div.appendChild(header);
        div.appendChild(p1);

        return div;
    }

    private getColorValue(color: Fill | string): string {
        // Override color settings if in high contrast mode
        if (this.host.colorPalette.isHighContrast) {
            return this.host.colorPalette.foreground.value;
        }

        // If plain string, just return it
        if (typeof (color) === 'string') {
            return color;
        }
        // Otherwise, extract string representation from Fill type object
        return color.solid.color;
    }

    private initAverageLine() {
        this.averageLine = this.svg
            .append('g')
            .classed('averageLine', true);

        this.averageLine.append('line')
            .attr('id', 'averageLine');

        this.averageLine.append('text')
            .attr('id', 'averageLineLabel');
    }

    private handleAverageLineUpdate(height: number, width: number, yScale: ScaleLinear<number, number>) {
        const average = this.calculateAverage();
        const fontSize = Math.min(height, width) * ParetoChart.Config.xAxisFontMultiplier;
        const chosenColor = this.getColorValue(this.formattingSettings.averageLine.fill.value.value);
        // If there's no room to place label above line, place it below
        const labelYOffset = fontSize * ((yScale(average) > fontSize * 1.5) ? -0.5 : 1.5);

        this.averageLine
            .style("font-size", fontSize)
            .style("display", (this.formattingSettings.averageLine.show.value) ? "initial" : "none")
            .attr("transform", "translate(0, " + Math.round(yScale(average)) + ")");

        this.averageLine.select("#averageLine")
            .style("stroke", chosenColor)
            .style("stroke-width", "3px")
            .style("stroke-dasharray", "6,6")
            .attr("x1", 0)
            .attr("x1", "" + width);

        this.averageLine.select("#averageLineLabel")
            .text("Average: " + average.toFixed(2))
            .attr("transform", "translate(0, " + labelYOffset + ")")
            .style("fill", this.formattingSettings.averageLine.showDataLabel.value ? chosenColor : "none");
    }

    private calculateAverage(): number {
        if (this.barDataPoints.length === 0) {
            return 0;
        }

        let t = 0;

        this.barDataPoints.forEach((value: BarChartDataPoint) => {
            t += <number>value.value;
        });

        console.log(t)

        return t / this.barDataPoints.length;
    }

    
}
