import co2eq from "@tmrow/bloom-contrib/co2eq"
import * as bloomDefinitions from "@tmrow/bloom-contrib/definitions"
import specificHeatDemandByYearData from "./specificHeatDemandByYear.json"

import {Estimate, ValidUntilSource} from "../sources"
import {EstimationResponse, Units} from ".."
import * as t from "io-ts"

const EnergySource = t.readonly(
  t.keyof({
    oil: null,
    naturalGas: null,
    electricity: null,
    LPG: null,
    solidFuels: null,
  }),
)

type EnergySource = t.TypeOf<typeof EnergySource>

export const HeatingEstimationParams = t.type({
  householdSize: t.readonly(t.number),
  apartmentSize: t.readonly(t.number),
  apartmentAge: t.readonly(t.number),
  energySource: EnergySource,
})

export type HeatingEstimationParams = t.TypeOf<typeof HeatingEstimationParams>

const carbonIntensityOfEnergySources = Estimate.of(
  new ValidUntilSource(
    {
      oil: 255,
      naturalGas: 200,
      electricity: 169,
      LPG: 227,
      solidFuels: 360,
    },
    "https://www.minzp.sk/files/iep/metodika_uhlikova_stopa.pdf  ,   https://cepa.priateliazeme.sk/images/publikacie/EVS_vystupy/M10_web.pdf",
    {
      en: {title: "Carbon intensity of different energy sources in Germany (g/kWh)"},
      de: {
        title: "Emisie CO2 z rôznych zdrojov energie na Slovensku (g/kWh)",
      },
    },
    new Date("2021/12/25"),
  ),
)

const specificHeatDemandByYear = Estimate.of(
  new ValidUntilSource(
    specificHeatDemandByYearData,
    "http://energieberatung.ibs-hlk.de/eb_begr.htm",
    {
      en: {title: "Specific heat demand by year (kWh/m²a)"},
      de: {
        title: "Špecifická potreba tepla za rok (kWh/m²a)",
      },
    },
    new Date("2021/12/25"),
  ),
)

export const estimateEmissions = (req: HeatingEstimationParams): EstimationResponse => {
  const estimatedEmissions = Estimate.combine(
    carbonIntensityOfEnergySources,
    specificHeatDemandByYear,
  )((carbonIntensityOfEnergySources, specificHeatDemandByYear) => {
    const specificHeatDemand = specificHeatDemandByYear.find(
      x => x.yearRange.low <= req.apartmentAge && x.yearRange.high >= req.apartmentAge,
    )?.specificHeatDemand

    const carbonIntensity = carbonIntensityOfEnergySources[req.energySource]

    if (specificHeatDemand === undefined) {
      throw new Error("Could not estimate emissions")
    } else if (req.householdSize <= 0) {
      return 0
    } else {
      return (req.apartmentSize * specificHeatDemand * carbonIntensity) / 1000 / req.householdSize
    }
  })

  return {
    estimatedEmissions: estimatedEmissions.value,
    unit: Units.KG_CO2E_PER_YEAR,
    sources: estimatedEmissions.exportSources(),
  }
}
