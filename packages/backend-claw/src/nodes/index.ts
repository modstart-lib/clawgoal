import {
  extendScheduleMap,
  extendRouterTypes,
} from '../../../backend/src/workflow/engine.js'
import AgentModelSchedule from './AgentModel/schedule.js'
import AgentRouterSchedule from './AgentRouter/schedule.js'
import AgentToolSchedule from './AgentTool/schedule.js'
import AgentSubgraphSchedule from './AgentSubgraph/schedule.js'
import ContextRouterSchedule from './ContextRouter/schedule.js'
import AgentCodeSchedule from './AgentCode/schedule.js'

export function registerAgentNodes() {
  extendScheduleMap('AgentModel', AgentModelSchedule)
  extendScheduleMap('Router', AgentRouterSchedule)
  extendScheduleMap('AgentTool', AgentToolSchedule)
  extendScheduleMap('AgentSubgraph', AgentSubgraphSchedule)
  extendScheduleMap('ContextRouter', ContextRouterSchedule)
  extendScheduleMap('AgentCode', AgentCodeSchedule)
  extendRouterTypes('AgentCode')
}
