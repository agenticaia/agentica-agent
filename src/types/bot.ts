export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface AIClass {
    createChat(messages: ChatMessage[], model?: string): Promise<string>;
}

export interface BotState {
    update: (props: {[key: string]: any}) => Promise<void>;
    set: (props: {[key: string]: any}) => Promise<void>;
    getMyState: <K = any>() => {[key: string]: K};
    get: <K = any>(prop: string) => K;
    getAllState: () => {[key: string]: any};
    clear: () => void;
}

export interface BotContext {
    from: string;
    body: string;
    id?: string;
    name?: string;
    timestamp?: number;
    [k: string]: any;
}

export type FlowDynamicMessage = { body: string; delay?: number } | string;

export type Flow = unknown;

export interface BotMethods {
    state: BotState;
    gotoFlow(flow: Flow): Promise<void>;
    extensions: { ai?: AIClass } & Record<string, any>;
    flowDynamic(
        msg: FlowDynamicMessage | FlowDynamicMessage[]
    ): Promise<void>;
    endFlow?(): Promise<void>;
}

export type FlowHandler = (
    ctx: BotContext,
    methods: BotMethods
) => Promise<void> | void;

// declare global {
//     interface Global {
//         globalFlags: {
//             agentMessageReceived: boolean;
//             [k: string]: any;
//         };
//     }
// }

// export {}

export interface IConfirmedData {
    id: string | null;
    full_name: string | null,
    startDate: string | null,
    email: string | null,
    phone: string | null;
}
