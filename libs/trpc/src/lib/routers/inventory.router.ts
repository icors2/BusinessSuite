import {
  InventoryService,
  LocationService,
  adjustSchema,
  allocateSchema,
  createBinSchema,
  createLocationSchema,
  deallocateSchema,
  listBinsSchema,
  listLocationsSchema,
  lookupByBinSchema,
  lookupByLocationSchema,
  lookupByProductSchema,
  moveSchema,
  pickSchema,
  receiveSchema,
  shipSchema,
} from 'wms';
import { editorProcedure, protectedProcedure, router } from '../trpc';

export function createInventoryRouter(
  inventoryService: InventoryService,
  locationService: LocationService,
) {
  return router({
    createLocation: editorProcedure
      .input(createLocationSchema)
      .mutation(({ ctx, input }) =>
        locationService.createLocation(input, ctx.user?.userId),
      ),

    listLocations: protectedProcedure
      .input(listLocationsSchema)
      .query(({ input }) => locationService.listLocations(input)),

    createBin: editorProcedure
      .input(createBinSchema)
      .mutation(({ ctx, input }) =>
        locationService.createBin(input, ctx.user?.userId),
      ),

    listBins: protectedProcedure
      .input(listBinsSchema)
      .query(({ input }) => locationService.listBins(input)),

    receive: editorProcedure
      .input(receiveSchema)
      .mutation(({ ctx, input }) =>
        inventoryService.receive(input, ctx.user?.userId),
      ),

    move: editorProcedure
      .input(moveSchema)
      .mutation(({ ctx, input }) =>
        inventoryService.move(input, ctx.user?.userId),
      ),

    pick: editorProcedure
      .input(pickSchema)
      .mutation(({ ctx, input }) =>
        inventoryService.pick(input, ctx.user?.userId),
      ),

    ship: editorProcedure
      .input(shipSchema)
      .mutation(({ ctx, input }) =>
        inventoryService.ship(input, ctx.user?.userId),
      ),

    adjust: editorProcedure
      .input(adjustSchema)
      .mutation(({ ctx, input }) =>
        inventoryService.adjust(input, ctx.user?.userId),
      ),

    allocate: editorProcedure
      .input(allocateSchema)
      .mutation(({ ctx, input }) =>
        inventoryService.allocate(input, ctx.user?.userId),
      ),

    deallocate: editorProcedure
      .input(deallocateSchema)
      .mutation(({ ctx, input }) =>
        inventoryService.deallocate(input, ctx.user?.userId),
      ),

    byProduct: protectedProcedure
      .input(lookupByProductSchema)
      .query(({ input }) => inventoryService.lookupByProduct(input)),

    byBin: protectedProcedure
      .input(lookupByBinSchema)
      .query(({ input }) => inventoryService.lookupByBin(input)),

    byLocation: protectedProcedure
      .input(lookupByLocationSchema)
      .query(({ input }) => inventoryService.lookupByLocation(input)),
  });
}
