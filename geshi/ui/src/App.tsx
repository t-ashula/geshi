import { createRouter, RouterProvider, Route, RootRoute } from '@tanstack/react-router';
import HomePage from './components/HomePage';

const rootRoute = new RootRoute();

const homeRoute = new Route({
	getParentRoute: () => rootRoute,
	path: '/',
	component: HomePage
});

const router = createRouter({ routeTree: rootRoute.addChildren([homeRoute]) });

export default function App() {
	return <RouterProvider router={router} />;
}
