# Linear Algebra course notes

One section per concept on the course map.

## Vectors and span
A vector is a quantity with size and direction, written as a list of numbers such as (2, -1, 3). A linear combination multiplies vectors by numbers and adds them. The span of a set of vectors is every linear combination they can make. Two vectors in the plane that do not point along the same line span the whole plane; two that lie on one line span only that line.

## Linear independence
Vectors are linearly independent when none of them is a linear combination of the others. Equivalently, the only way to combine them into the zero vector is with every coefficient zero. Dependent vectors add no new direction, so removing one does not shrink the span. In n dimensions at most n vectors can be independent.

## Matrix operations
Matrices of the same size add entry by entry and scale by multiplying every entry. The product AB is defined only when A has as many columns as B has rows; each entry is a row of A dotted with a column of B. Matrix multiplication is not commutative, so AB and BA are usually different, and one may exist when the other does not.

## Inverses
The inverse of a square matrix A is the matrix that undoes it: A times its inverse is the identity. Only square matrices with nonzero determinant have inverses. When A is invertible, the system Ax = b has exactly one solution, x equals the inverse of A times b. The inverse of a product reverses the order: the inverse of AB is the inverse of B times the inverse of A.

## Solving systems
Gaussian elimination row-reduces an augmented matrix with three moves: swap rows, scale a row by a nonzero number, and add a multiple of one row to another. These moves never change the solutions. The reduced form shows whether the system has exactly one solution, infinitely many when there are free variables, or none when a row reads 0 equals a nonzero number.

## Determinants
The determinant is a single number from a square matrix. For a 2 by 2 matrix with rows (a, b) and (c, d) it is ad minus bc. Its absolute value is the factor by which the matrix scales area or volume, and a determinant of zero means the matrix squashes space flat and has no inverse. The determinant of a product is the product of the determinants.

## Eigenvalues
An eigenvector of A is a nonzero vector that A only stretches, so A times v equals lambda times v. The stretch factor lambda is the eigenvalue. Eigenvalues are the roots of the characteristic equation, the determinant of A minus lambda times the identity set equal to zero. A matrix can have repeated or complex eigenvalues.

## Diagonalization
A matrix is diagonalizable when it has enough independent eigenvectors to form a basis. Then A equals P D times the inverse of P, where the columns of P are eigenvectors and D is diagonal with the eigenvalues. Powers become easy: A to the k equals P times D to the k times the inverse of P. A matrix with n distinct eigenvalues is always diagonalizable.
