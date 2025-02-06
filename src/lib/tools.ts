type Point = [number, number, number];
type ReturnPoint = { position: [number, number, number] | null; zSquared: number };

/**
 * Trilaterates the position based on four points and their distances.
 *
 * @param p1 - The first point.
 * @param d1 - The distance to the first point.
 * @param p2 - The second point.
 * @param d2 - The distance to the second point.
 * @param p3 - The third point.
 * @param d3 - The distance to the third point.
 * @param p4 - The fourth point.
 * @param d4 - The distance to the fourth point.
 * @returns The trilaterated point or null if no real solution exists.
 */
export function trilaterate4(
    p1: Point,
    d1: number,
    p2: Point,
    d2: number,
    p3: Point,
    d3: number,
    p4: Point,
    d4: number,
): ReturnPoint {
    const ex = normalize(subtract(p2, p1));
    const i = dot(ex, subtract(p3, p1));
    const ey = normalize(subtract(subtract(p3, p1), scale(ex, i)));
    const ez = cross(ex, ey);

    const d = distance(p1, p2);
    const j = dot(ey, subtract(p3, p1));

    const x = (d1 ** 2 - d2 ** 2 + d ** 2) / (2 * d);
    const y = (d1 ** 2 - d3 ** 2 + i ** 2 + j ** 2) / (2 * j) - (i / j) * x;
    const zSquared = d1 ** 2 - x ** 2 - y ** 2;

    if (zSquared < -16) {
        // Allow a small tolerance for floating-point errors
        return { position: null, zSquared: zSquared };
    }

    const z = Math.sqrt(Math.max(zSquared, 0)); // Ensure non-negative value for sqrt
    const pA = add(p1, add(scale(ex, x), add(scale(ey, y), scale(ez, z))));
    const pB = add(p1, add(scale(ex, x), add(scale(ey, y), scale(ez, -z))));

    return { position: chooseCorrectPoint(pA, pB, p4, d4), zSquared: zSquared };
}

/**
 * Chooses the point that best matches the distance to the fourth point.
 *
 * @param pA - The first candidate point.
 * @param pB - The second candidate point.
 * @param p4 - The fourth point.
 * @param d4 - The distance to the fourth point.
 * @returns The point that best matches the distance to the fourth point.
 */
function chooseCorrectPoint(pA: Point, pB: Point, p4: Point, d4: number): Point {
    const dA = distance(pA, p4);
    const dB = distance(pB, p4);
    return Math.abs(dA - d4) < Math.abs(dB - d4) ? pA : pB;
}

/**
 * Subtracts point b from point a.
 *
 * @param a - The first point.
 * @param b - The second point.
 * @returns The resulting point after subtraction.
 */
function subtract(a: Point, b: Point): Point {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/**
 * Adds point a and point b.
 *
 * @param a - The first point.
 * @param b - The second point.
 * @returns The resulting point after addition.
 */
function add(a: Point, b: Point): Point {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/**
 * Scales point v by scalar s.
 *
 * @param v - The point to scale.
 * @param s - The scalar value.
 * @returns The resulting point after scaling.
 */
function scale(v: Point, s: number): Point {
    return [v[0] * s, v[1] * s, v[2] * s];
}

/**
 * Computes the dot product of points a and b.
 *
 * @param a - The first point.
 * @param b - The second point.
 * @returns The dot product of the two points.
 */
function dot(a: Point, b: Point): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Computes the cross product of points a and b.
 *
 * @param a - The first point.
 * @param b - The second point.
 * @returns The cross product of the two points.
 */
function cross(a: Point, b: Point): Point {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/**
 * Computes the distance between points a and b.
 *
 * @param a - The first point.
 * @param b - The second point.
 * @returns The distance between the two points.
 */
function distance(a: Point, b: Point): number {
    return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

/**
 * Normalizes point v to a unit vector.
 *
 * @param v - The point to normalize.
 * @returns The normalized point.
 */
function normalize(v: Point): Point {
    const mag = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
    return [v[0] / mag, v[1] / mag, v[2] / mag];
}

// Example
const p1: Point = [0, 0, 0],
    d1 = 5;
const p2: Point = [10, 0, 0],
    d2 = 5;
const p3: Point = [5, 5, 0],
    d3 = 5;
const p4: Point = [5, 2, 5],
    d4 = 5;

console.log(trilaterate4(p1, d1, p2, d2, p3, d3, p4, d4));
