import type {Route} from "./+types/home";
import {Welcome} from "../welcome/welcome";
import imgUrl from '../explanation.png'
import {
    Alert,
    Button, Center,
    Container,
    Fieldset, Image,
    List, ListItem,
    MultiSelect,
    NumberInput,
    SimpleGrid,
    Stack,
    Text, Title
} from "@mantine/core";
import {Form} from "react-router";

export function meta({}: Route.MetaArgs) {
    return [
        {title: "New React Router App"},
        {name: "description", content: "Welcome to React Router!"},
    ];
}

class MinigameState {
    cylinderPositions: number[] = []
    cylinderDirections: number[][] = []
    trace: string[] = []

    constructor(cylinderPositions: number[], cylinderDirections: number[][], trace: string[] = []) {
        this.cylinderPositions = cylinderPositions
        this.cylinderDirections = cylinderDirections
        this.trace = trace
    }

    moveCylinder(cylinderId: number, down: boolean): MinigameState | null {
        // when we move one cylinder, all other cylinders move with it either in the same direction (1) or in the opposite direction (-1) or not at all (0)
        // So if we move down (increasing the hole number), then we add the cylinder direction
        const dir = down ? 1 : -1;
        const newPositions = [...this.cylinderPositions];
        const directionsGivenCylinder = this.cylinderDirections[cylinderId - 1];
        for (let i = 0; i < this.cylinderPositions.length; i++) {
            const newPos= this.cylinderPositions[i] + dir * directionsGivenCylinder[i];
            if (newPos < 1 || newPos > 7) {
                return null; // illegal move
            }
            newPositions[i] = newPos;
        }
        return new MinigameState(newPositions, this.cylinderDirections, [...this.trace, `cylinder ${cylinderId} ${down ? 'LEFT' : 'RIGHT'}`]);
    }

    stateId(): string {
        return this.cylinderPositions.join("-") + "-" + this.cylinderDirections.join("-")
    }

    isTerminal(): boolean {
        return this.cylinderPositions.every(pos => pos === 4);
    }
}

const allCylinderIds = [1, 2, 3, 4, 5, 6]

function search(currentState: MinigameState, seen: Set<string>): null | string[] {
    const queue = [currentState];
    while (queue.length > 0) {
        currentState = queue.shift()!;
        if (currentState.isTerminal())
            return currentState.trace;
        // successor generation
        for (let i = 0; i < currentState.cylinderPositions.length; i++) {
            const succ1 = currentState.moveCylinder(i+1, true);
            const succ2 = currentState.moveCylinder(i+1, false);
            if (succ1 && !seen.has(succ1.stateId())) {
                queue.push(succ1);
                seen.add(succ1.stateId());
            }
            if (succ2 && !seen.has(succ2.stateId())) {
                queue.push(succ2);
                seen.add(succ2.stateId());
            }
        }
    }
    return null;
}

export function clientLoader({request}: Route.ClientLoaderArgs) {
    // parse all query params
    const queryParams = new URLSearchParams(request.url.split("?")[1]);
    if (queryParams.size === 0) {
        return {
            trace: ["Please fill out the form correctly"]
        };
    }
    const allPositions = allCylinderIds.map(id => parseInt(queryParams.get(`cylinder-${id}-hole`) ?? "1"));
    const allDirections = allCylinderIds.map(id => {
        const followers = (queryParams.get(`cylinder-${id}-followers`)?.split(",") ?? []).map(f => parseInt(f)-1);
        const antiFollowers = (queryParams.get(`cylinder-${id}-anti-followers`)?.split(",") ?? []).map(f => parseInt(f)-1);
        const directions = allCylinderIds.map(id => 0);
        for (const f of [...followers, id-1]) { // trivially, all cylinders move with themselves
            directions[f] = 1;
        }
        for (const f of antiFollowers) {
            directions[f] = -1;
        }
        return directions;
    });
    const initialState = new MinigameState(allPositions, allDirections);
    const seen = new Set<string>();
    const now = Date.now();
    const trace = search(initialState, seen);
    console.log(`search took ${Date.now() - now}ms`);
    if (trace == null) {
        return {
            error: "no solution found (did you fill out the form correctly?)"
        }
    }
    return {
        trace: trace
    }
}

function CylinderInfoInput({cylinderId, allCylinderIds}: { cylinderId: number, allCylinderIds: number[] }) {
    const data = allCylinderIds.filter(id => id !== cylinderId);
    return <Fieldset>
        <legend>
            Cylinder {cylinderId}
        </legend>
        <NumberInput mb={"md"} name={`cylinder-${cylinderId}-hole`} min={1} max={7} label={"Current hole"}
                     description={"1 is the top-most hole and 7 is the bottom-most hole"}/>
        <MultiSelect mb={"md"} name={`cylinder-${cylinderId}-followers`} data={data}
                     label={`Cylinders that move with cylinder ${cylinderId} in the same direction`}/>
        <MultiSelect name={`cylinder-${cylinderId}-anti-followers`} data={data}
                     label={`Cylinders that move with cylinder ${cylinderId} in the opposite direction`}/>
    </Fieldset>
}

export default function Home({ loaderData }: Route.ComponentProps) {
    return <Container py={"lg"}>
        <Title>
            Gothic 1 Remake: Lockpick Puzzle Solver
        </Title>
        <Form method={"GET"}>
            <Text mb={"lg"}>
                Welcome! Begin by describing the starting state of the lockpicking puzzle by filling out the form below.
                If you're unsure what the input fields mean, see the illustration at the bottom of the page.
            </Text>
            <SimpleGrid cols={{
                base: 1,
                sm: 2,
                md: 3
            }}>
                {allCylinderIds.map(cylinderId => <CylinderInfoInput key={cylinderId} cylinderId={cylinderId}
                                                                     allCylinderIds={allCylinderIds}/>)}
            </SimpleGrid>
            <Button mt={"lg"} type={"submit"}>Solve it!</Button>
        </Form>
        {loaderData?.error && <Alert mt={"lg"} color={"red"}>{loaderData.error}</Alert>}
        {loaderData?.trace && <Alert mt={"lg"} color={"green"}>
            <Title order={4}>Solution</Title>
            <Text>For each line, go to the correct cylinder and then press either LEFT or RIGHT on the controller/keyboard</Text>
            <List type={"unordered"}>
                {loaderData.trace.map((e, idx) => (<ListItem key={idx}>
                    {e}
                </ListItem>))}
            </List>
        </Alert>}
        <Center mt={"lg"}>
            <Image src={imgUrl} alt={"Lockpicking puzzle"} maw={600}/>
        </Center>
    </Container>
}
